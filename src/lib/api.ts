// EXPORTS: API_BASE, getToken, setToken, clearToken, getProfile, setProfile, ApiError, api, isUnauthorized

import type {
  IAccessKey,
  IAdminAccount,
  IBlockInput,
  IDeviceInfo,
  IHealth,
  ILoginResponse,
  IOtpStatus,
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
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('无法连接服务器，请检查网络或 VITE_API_BASE_URL 配置', 0, 'network_error');
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
  listDevices: () => request<IDeviceInfo[]>('/api/devices'),
  removeDevice: (id: number) =>
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
  listKeys: () => request<IAccessKey[]>('/api/keys'),
  createKey: (body: { name?: string; credits?: string; allowed_models?: string[] }) =>
    request<IAccessKey>('/api/keys', { method: 'POST', body: JSON.stringify(body) }),
  updateKey: (id: number, patch: { name?: string; enabled?: boolean; allowed_models?: string[] | null }) =>
    request<IAccessKey>(`/api/keys/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteKey: (id: number) => request<void>(`/api/keys/${id}`, { method: 'DELETE' }),
  resetKeyCredits: (id: number, credits: string) =>
    request<IAccessKey>(`/api/keys/${id}/credits`, {
      method: 'POST',
      body: JSON.stringify({ credits }),
    }),

  // ---- 上游块 ----
  listBlocks: () => request<IUpstreamBlock[]>('/api/blocks'),
  createBlock: (body: IBlockInput) =>
    request<IUpstreamBlock>('/api/blocks', { method: 'POST', body: JSON.stringify(body) }),
  updateBlock: (id: string, body: Partial<IBlockInput>) =>
    request<IUpstreamBlock>(`/api/blocks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteBlock: (id: string) =>
    request<void>(`/api/blocks/${id}`, { method: 'DELETE' }),
  listBlockKeys: (id: string) => request<IUpstreamKey[]>(`/api/blocks/${id}/keys`),
  addBlockKeys: (id: string, secrets: string[], weight?: number) =>
    request<void>(`/api/blocks/${id}/keys`, {
      method: 'POST',
      body: JSON.stringify(weight != null ? { secrets, weight } : { secrets }),
    }),
  removeBlockKeys: (id: string, ids: number[]) =>
    request<void>(`/api/blocks/${id}/keys/remove`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  pauseBlockKeys: (id: string, ids: number[]) =>
    request<void>(`/api/blocks/${id}/keys/pause`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  resumeBlockKeys: (id: string, ids: number[]) =>
    request<void>(`/api/blocks/${id}/keys/resume`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  testBlockKey: (id: string, keyId: number) =>
    request<unknown>(`/api/blocks/${id}/keys/${keyId}/test`, { method: 'POST' }),

  // ---- 请求日志 ----
  listLogs: (limit = 500) => request<IRequestLog[]>(`/api/logs?limit=${limit}`),
};
