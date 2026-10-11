// EXPORTS: API_BASE, getToken, setToken, clearToken, getProfile, setProfile, ApiError, api, isUnauthorized

import type {
  IAccessKey,
  IAdminAccount,
  IBlockInput,
  IDeviceInfo,
  IHealth,
  IKeyListResponse,
  IKeySelf,
  IKeyUsage,
  ILoginResponse,
  IOtpStatus,
  IProvider,
  IRequestLog,
  ISystemSettings,
  IUpstreamBlock,
  IUpstreamKey,
} from '@/data/admin';

/** 后端 API 基础地址，通过环境变量注入；为空时走同源 */
export const API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL ?? '';

const TOKEN_KEY = 'aequi_admin_token';
const PROFILE_KEY = 'aequi_admin_profile';
const ACCESS_KEY_KEY = 'aequi_access_key';

/**
 * 凭证的本地存放。
 *
 * 面板就在浏览器里跑，直接用原生 localStorage；读写都包一层 try——
 * 隐私模式等场景下它会抛异常，那种时候按「没有」处理即可，
 * 不该让整个页面因此崩掉（顶多重新登录一次）。
 */
function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 写不进去就当作没保存 */
  }
}

function removeItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* 同上 */
  }
}

export function getToken(): string | null {
  return readItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  writeItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  removeItem(TOKEN_KEY);
}

export function getProfile(): IAdminAccount | null {
  const raw = readItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IAdminAccount;
  } catch {
    return null;
  }
}

export function setProfile(account: IAdminAccount): void {
  writeItem(PROFILE_KEY, JSON.stringify(account));
}

/**
 * 访问密钥登录（密钥自助视图）。
 *
 * 与管理员的登录令牌**互斥**：同一个浏览器同时只保留一种身份，
 * 登录任一侧时清掉另一侧，避免请求带着身份不明两把凭证。
 */
export function getAccessKey(): string | null {
  return readItem(ACCESS_KEY_KEY);
}

export function setAccessKey(secret: string): void {
  writeItem(ACCESS_KEY_KEY, secret);
}

export function clearAccessKey(): void {
  removeItem(ACCESS_KEY_KEY);
}

/** 归一化后的 API 错误：message 来自后端 error.message，type 来自 error.type */
export class ApiError extends Error {
  status: number;
  type: string;

  constructor(message: string, status: number, type: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.type = type;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // 管理员令牌与访问密钥同时只会存在一个（见 setAccessKey 的说明）。
  const credential = getToken() ?? getAccessKey();
  if (credential) headers.set('Authorization', `Bearer ${credential}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('无法连接服务器，请稍后重试', 0, 'network_error');
  }

  if (!res.ok) {
    let message = `请求失败 (HTTP ${res.status})`;
    let type = 'http_error';
    try {
      const data = (await res.json()) as { error?: { message?: string; type?: string } };
      if (data?.error?.message) message = data.error.message;
      if (data?.error?.type) type = data.error.type;
    } catch {
      // 非 JSON 错误体，保留默认 message
    }
    throw new ApiError(message, res.status, type);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** 401 / unauthorized 时返回 true（调用方应清除 token 并跳转登录页） */
export function isUnauthorized(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.type === 'unauthorized');
}

export const api = {
  // ---- 公开接口 ----
  health: () => request<IHealth>('/health'),
  /** 可用的第三方登录方式；后端没提供时返回空数组。 */
  providers: () => request<IProvider[]>('/api/auth/providers'),

  // ---- 访问密钥自助（用访问密钥认证，只能看到自己）----
  keyMe: () => request<IKeySelf>('/api/key/me'),
  keyUsage: (limit = 50) => request<IKeyUsage>(`/api/key/usage?limit=${limit}`),

  // ---- 认证与会话 ----
  login: (body: { username: string; password: string; otp?: string }) =>
    request<ILoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<IAdminAccount>('/api/auth/me'),
  changePassword: (body: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) =>
    request<{ revoked?: number }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateUsername: (body: { current_password: string; username: string }) =>
    request<IAdminAccount>('/api/auth/username', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ---- 设备管理 ----
  // 后端的列表接口统一把数组包在具名字段里（`{ devices: [...] }`），
  // 这里解包成数组，调用方直接当列表用。
  listDevices: async () => {
    const res = await request<{ devices: IDeviceInfo[] }>('/api/devices');
    return res.devices;
  },
  removeDevice: (id: string) =>
    request<{ revoked?: number }>(`/api/devices/${id}`, { method: 'DELETE' }),
  removeAllDevices: () =>
    request<{ revoked?: number }>('/api/devices', { method: 'DELETE' }),

  // ---- OTP ----
  getOtp: () => request<IOtpStatus>('/api/otp'),
  setupOtp: () =>
    request<{ secret: string; otpauth_url: string }>('/api/otp/setup', { method: 'POST' }),
  enableOtp: (code: string) =>
    request<void>('/api/otp/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  disableOtp: (code?: string) =>
    request<void>('/api/otp/disable', {
      method: 'POST',
      body: JSON.stringify(code ? { code } : {}),
    }),

  // ---- 系统设置 ----
  getSettings: () => request<ISystemSettings>('/api/settings'),
  updateSettings: (patch: Partial<ISystemSettings>) =>
    request<ISystemSettings>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // ---- 访问密钥 ----
  listKeys: (params?: { page?: number; page_size?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page != null) query.set('page', String(params.page));
    if (params?.page_size != null) query.set('page_size', String(params.page_size));
    if (params?.search) query.set('search', params.search);
    const suffix = query.toString();

    return request<IKeyListResponse>(`/api/keys${suffix ? `?${suffix}` : ''}`);
  },
  createKey: (body: {
    name?: string;
    credits?: string;
    unlimited?: boolean;
    allowed_models?: string[];
  }) => request<IAccessKey>('/api/keys', { method: 'POST', body: JSON.stringify(body) }),
  updateKey: (id: string, patch: { name?: string; enabled?: boolean; allowed_models?: string[] | null }) =>
    request<IAccessKey>(`/api/keys/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteKey: (id: string) => request<void>(`/api/keys/${id}`, { method: 'DELETE' }),
  /** 调整额度：余额与无限开关，只提交要改的那部分。 */
  resetKeyCredits: (id: string, patch: { credits?: string; unlimited?: boolean }) =>
    request<IAccessKey>(`/api/keys/${id}/credits`, {
      method: 'POST',
      body: JSON.stringify(patch),
    }),

  // ---- 上游块 ----
  listBlocks: async () => {
    const res = await request<{ blocks: IUpstreamBlock[] }>('/api/blocks');
    return res.blocks;
  },
  createBlock: (body: IBlockInput) =>
    request<IUpstreamBlock>('/api/blocks', { method: 'POST', body: JSON.stringify(body) }),
  updateBlock: (id: string, body: Partial<IBlockInput>) =>
    request<IUpstreamBlock>(`/api/blocks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteBlock: (id: string) =>
    request<void>(`/api/blocks/${id}`, { method: 'DELETE' }),
  listBlockKeys: async (id: string) => {
    const res = await request<{ keys: IUpstreamKey[] }>(`/api/blocks/${id}/keys`);
    return res.keys;
  },
  addBlockKeys: (id: string, secrets: string[], weight?: number) =>
    request<void>(`/api/blocks/${id}/keys`, {
      method: 'POST',
      body: JSON.stringify(weight != null ? { secrets, weight } : { secrets }),
    }),
  removeBlockKeys: (id: string, ids: string[]) =>
    request<void>(`/api/blocks/${id}/keys/remove`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  pauseBlockKeys: (id: string, ids: string[]) =>
    request<void>(`/api/blocks/${id}/keys/pause`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  resumeBlockKeys: (id: string, ids: string[]) =>
    request<void>(`/api/blocks/${id}/keys/resume`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  /** 拉取上游模型列表。只有已保存的块才有出口与密钥可用来发这次请求。 */
  fetchBlockModels: async (id: string) => {
    const res = await request<{ models: string[] }>(`/api/blocks/${encodeURIComponent(id)}/models/fetch`, {
      method: 'POST',
    });
    return res.models;
  },
  testBlockKey: (id: string, keyId: string) =>
    request<unknown>(`/api/blocks/${id}/keys/${keyId}/test`, { method: 'POST' }),

  // ---- 请求日志 ----
  /**
   * 请求日志。后端把数组包在 `logs` 字段里（响应体是个对象），
   * 这里解包成数组，调用方直接当列表用。
   */
  listLogs: async (limit = 500) => {
    const res = await request<{ logs: IRequestLog[] }>(`/api/logs?limit=${limit}`);
    return res.logs;
  },
};
