// EXPORTS: IHealth, ILoginResponse, IProvider, IAdminAccount, IDeviceInfo, IOtpStatus, ISystemSettings, IAccessKey, IKeyListResponse, IBlockModel, IBlockInput, IUpstreamBlock, IUpstreamKey, IKeySelf, IUsageSummary, IUsageRecord, IKeyUsage, IRequestLog

// ---- 公开接口 ----

export interface IHealth {
  status: string;
  version?: string;
  uptime_seconds?: number;
  account_configured?: boolean;
  providers?: IProvider[];
}

/** 第三方登录方式（后端尚未提供时列表为空）。 */
export interface IProvider {
  id: string;
  label: string;
}

export interface ILoginResponse {
  token: string;
  expires_at: number;
  account: {
    id: number;
    username: string;
    totp_enabled: boolean;
    created_at: number;
  };
}

// ---- 账号 / 会话 ----

export interface IAdminAccount {
  id: number;
  username: string;
  totp_enabled: boolean;
  created_at: number;
}

export interface IDeviceInfo {
  /** 会话 id：后端是随机字符串，不是数字。 */
  id: string;
  token_prefix: string;
  login_type: string;
  ip: string;
  user_agent: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  current: boolean;
}

// ---- OTP ----

export interface IOtpStatus {
  enabled: boolean;
  pending: boolean;
}

// ---- 系统设置 ----

export interface ISystemSettings {
  listen: string;
  cors_origins: string[];
  trust_proxy: boolean;
  token_ttl_hours: number;
  log_retention_days: number;
}

// ---- 访问密钥 ----

export interface IAccessKey {
  /** 密钥 id：后端是随机字符串，不是数字。 */
  id: string;
  name: string;
  secret?: string;
  key_prefix: string;
  credits: string;
  credits_scaled: number;
  /** 无限额度：不看余额，但用量照记。 */
  unlimited: boolean;
  enabled: boolean;
  allowed_models: string[] | null;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}

/** 密钥列表：`keys` 是当前页，`total` 用于分页器。 */
export interface IKeyListResponse {
  keys: IAccessKey[];
  total: number;
  page: number;
  page_size: number;
}

// ---- 模型计费配置 ----

/** 一个模型的计费配置（只影响倍率，不影响模型是否可用）。 */
export interface IModel {
  name: string;
  /** 倍率，四位小数字符串。 */
  multiplier: string;
  /** 同一数值的万分比整数。 */
  multiplier_bp: number;
  /** 配置是否生效；停用时计费回落到默认倍率。 */
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface IModelListResponse {
  models: IModel[];
}

// ---- 访问密钥自助（用访问密钥登录后可见）----

/** 密钥持有者能看到自己的信息，但拿不到明文（自己手里就有）。 */
export interface IKeySelf {
  name: string;
  key_prefix: string;
  credits: string;
  credits_scaled: number;
  /** 无限额度：余额不是限制，消耗仍然照记。 */
  unlimited: boolean;
  enabled: boolean;
  allowed_models: string[] | null;
  created_at: number;
  last_used_at: number | null;
}

export interface IUsageSummary {
  requests: number;
  failed: number;
  raw_tokens: number;
  final_tokens: number;
  credits: string;
  credits_scaled: number;
}

export interface IUsageRecord {
  id: number;
  model: string;
  status: string;
  prompt_tokens: number;
  completion_tokens: number;
  cache_tokens: number;
  estimated: boolean;
  stream: boolean;
  raw_tokens: number;
  multiplier: string;
  final_tokens: number;
  credits: string;
  error: string | null;
  created_at: number;
}

export interface IKeyUsage {
  summary: IUsageSummary;
  records: IUsageRecord[];
}

// ---- 上游块 ----

export interface IBlockModel {
  name: string;
  forward?: string;
}

export interface IBlockInput {
  id?: string;
  name: string;
  api_format: 'openai' | 'google' | 'anthropic';
  weight: number;
  base_url: string;
  proxy: string | null;
  models: IBlockModel[];
}

export interface IUpstreamBlock {
  id: string;
  name: string;
  api_format: 'openai' | 'google' | 'anthropic';
  weight: number;
  base_url: string;
  proxy: string | null;
  models: IBlockModel[];
  key_count?: number;
  available_keys?: number;
}

export interface IUpstreamKey {
  /** 上游密钥 id：后端是随机字符串，不是数字。 */
  id: string;
  block_id: string;
  secret: string;
  status: 'active' | 'paused' | 'disabled';
  weight: number;
  failure_count: number;
  cooldown_until: number | null;
  last_error: string | null;
  last_used_at: number | null;
  created_at: number;
}

// ---- 请求日志 ----

export interface IRequestLog {
  id: number;
  created_at: number;
  /** 访问密钥 id：后端是随机字符串。 */
  access_key_id: string | null;
  block_id: string | null;
  upstream_key_id: string | null;
  model: string;
  ip: string;
  user_agent: string;
  status: 'success' | 'error';
  error_detail: string | null;
  duration_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  cache_tokens: number;
  estimated: boolean;
  credits: string;
}
