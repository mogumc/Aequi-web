// EXPORTS: IHealth, ILoginResponse, IAdminAccount, IDeviceInfo, IOtpStatus, ISystemSettings, IAccessKey, IBlockModel, IBlockInput, IUpstreamBlock, IUpstreamKey, IRequestLog, MOCK_KEYS, MOCK_BLOCKS, MOCK_BLOCK_KEYS, MOCK_LOGS

// ---- 公开接口 ----

export interface IHealth {
  status: string;
  version?: string;
  uptime_seconds?: number;
  account_configured?: boolean;
  providers?: unknown[];
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
  id: number;
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
  id: number;
  name: string;
  secret?: string;
  key_prefix: string;
  credits: string;
  credits_scaled: number;
  enabled: boolean;
  allowed_models: string[] | null;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
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
  id: number;
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
  access_key_id: number | null;
  block_id: string | null;
  upstream_key_id: number | null;
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

// ---- 示例数据（后端未连通时的占位兜底） ----

const now = Math.floor(Date.now() / 1000);
const minutes = (n: number) => n * 60;
const hours = (n: number) => n * 3600;

export const MOCK_KEYS: IAccessKey[] = [
  {
    id: 1,
    name: '数据组-日常调用',
    key_prefix: 'ak_9f3a',
    credits: '120.0000',
    credits_scaled: 1200000,
    enabled: true,
    allowed_models: null,
    created_at: now - hours(24 * 30),
    updated_at: now - hours(24),
    last_used_at: now - minutes(6),
  },
  {
    id: 2,
    name: '客服机器人',
    key_prefix: 'ak_2c81',
    credits: '36.5000',
    credits_scaled: 365000,
    enabled: true,
    allowed_models: ['gpt-4o-mini'],
    created_at: now - hours(24 * 18),
    updated_at: now - hours(72),
    last_used_at: now - minutes(42),
  },
  {
    id: 3,
    name: '评测脚本',
    key_prefix: 'ak_b7e0',
    credits: '0.8000',
    credits_scaled: 8000,
    enabled: true,
    allowed_models: null,
    created_at: now - hours(24 * 9),
    updated_at: now - hours(5),
    last_used_at: now - minutes(120),
  },
  {
    id: 4,
    name: '外部合作方',
    key_prefix: 'ak_1d44',
    credits: '300.0000',
    credits_scaled: 3000000,
    enabled: false,
    allowed_models: ['gpt-4o', 'gpt-image-1'],
    created_at: now - hours(24 * 60),
    updated_at: now - hours(240),
    last_used_at: now - hours(360),
  },
  {
    id: 5,
    name: '已耗尽-归档',
    key_prefix: 'ak_00a2',
    credits: '0.0000',
    credits_scaled: 0,
    enabled: true,
    allowed_models: null,
    created_at: now - hours(24 * 90),
    updated_at: now - hours(12),
    last_used_at: now - hours(14),
  },
];

export const MOCK_BLOCKS: IUpstreamBlock[] = [
  {
    id: 'openai-main',
    name: 'OpenAI 官方',
    api_format: 'openai',
    weight: 3,
    base_url: 'https://api.openai.com',
    proxy: null,
    models: [
      { name: 'gpt-4o', forward: 'gpt-4o-2024-11-20' },
      { name: 'gpt-4o-mini' },
    ],
    key_count: 2,
    available_keys: 2,
  },
  {
    id: 'openai-relay',
    name: '中转线路 B',
    api_format: 'openai',
    weight: 1,
    base_url: 'https://relay.example.internal/v1',
    proxy: 'http://127.0.0.1:7890',
    models: [{ name: 'gpt-4o' }, { name: 'gpt-image-1' }],
    key_count: 1,
    available_keys: 0,
  },
  {
    id: 'anthropic-main',
    name: 'Claude 官方',
    api_format: 'anthropic',
    weight: 2,
    base_url: 'https://api.anthropic.com',
    proxy: null,
    models: [{ name: 'claude-sonnet-4-5' }],
    key_count: 1,
    available_keys: 1,
  },
];

export const MOCK_BLOCK_KEYS: IUpstreamKey[] = [
  {
    id: 11,
    block_id: 'openai-main',
    secret: 'sk-proj-A1bC2dE3fG4hI5jK6lM7nO8p',
    status: 'active',
    weight: 2,
    failure_count: 0,
    cooldown_until: null,
    last_error: null,
    last_used_at: now - minutes(3),
    created_at: now - hours(24 * 40),
  },
  {
    id: 12,
    block_id: 'openai-main',
    secret: 'sk-proj-Z9yX8wV7uT6sR5qP4oN3mL2k',
    status: 'paused',
    weight: 1,
    failure_count: 3,
    cooldown_until: now + minutes(12),
    last_error: '429 Too Many Requests',
    last_used_at: now - minutes(30),
    created_at: now - hours(24 * 12),
  },
  {
    id: 13,
    block_id: 'anthropic-main',
    secret: 'sk-ant-api03-QwErTyUiOpAsDfGhJkL',
    status: 'active',
    weight: 1,
    failure_count: 0,
    cooldown_until: null,
    last_error: null,
    last_used_at: now - minutes(15),
    created_at: now - hours(24 * 20),
  },
];

export const MOCK_LOGS: IRequestLog[] = [
  {
    id: 101,
    created_at: now - minutes(2),
    access_key_id: 1,
    block_id: 'openai-main',
    upstream_key_id: 11,
    model: 'gpt-4o',
    ip: '10.2.8.14',
    user_agent: 'aequi-sdk/1.2',
    status: 'success',
    error_detail: null,
    duration_ms: 820,
    prompt_tokens: 1830,
    completion_tokens: 412,
    cache_tokens: 512,
    estimated: false,
    credits: '0.0266',
  },
  {
    id: 102,
    created_at: now - minutes(9),
    access_key_id: 2,
    block_id: 'openai-main',
    upstream_key_id: 11,
    model: 'gpt-4o-mini',
    ip: '10.2.8.51',
    user_agent: 'python-httpx/0.27',
    status: 'success',
    error_detail: null,
    duration_ms: 460,
    prompt_tokens: 640,
    completion_tokens: 88,
    cache_tokens: 0,
    estimated: false,
    credits: '0.0050',
  },
  {
    id: 103,
    created_at: now - minutes(17),
    access_key_id: 3,
    block_id: 'anthropic-main',
    upstream_key_id: 13,
    model: 'claude-sonnet-4-5',
    ip: '10.2.9.7',
    user_agent: 'curl/8.4',
    status: 'error',
    error_detail: '上游 401: invalid x-api-key（已重试 1 次）',
    duration_ms: 240,
    prompt_tokens: 0,
    completion_tokens: 0,
    cache_tokens: 0,
    estimated: false,
    credits: '0.0000',
  },
  {
    id: 104,
    created_at: now - minutes(26),
    access_key_id: 1,
    block_id: 'openai-main',
    upstream_key_id: 12,
    model: 'gpt-4o',
    ip: '10.2.8.14',
    user_agent: 'aequi-sdk/1.2',
    status: 'success',
    error_detail: null,
    duration_ms: 1320,
    prompt_tokens: 3200,
    completion_tokens: 980,
    cache_tokens: 1024,
    estimated: false,
    credits: '0.0780',
  },
  {
    id: 105,
    created_at: now - minutes(38),
    access_key_id: 2,
    block_id: 'openai-relay',
    upstream_key_id: null,
    model: 'gpt-image-1',
    ip: '10.2.8.51',
    user_agent: 'python-httpx/0.27',
    status: 'error',
    error_detail: 'upstream_unavailable：块内无可用密钥（全部退避中）',
    duration_ms: 96,
    prompt_tokens: 0,
    completion_tokens: 0,
    cache_tokens: 0,
    estimated: false,
    credits: '0.0000',
  },
  {
    id: 106,
    created_at: now - minutes(52),
    access_key_id: 5,
    block_id: 'openai-main',
    upstream_key_id: 11,
    model: 'gpt-4o-mini',
    ip: '10.2.9.30',
    user_agent: 'Go-http-client/2.0',
    status: 'success',
    error_detail: null,
    duration_ms: 380,
    prompt_tokens: 220,
    completion_tokens: 64,
    cache_tokens: 0,
    estimated: true,
    credits: '0.0021',
  },
  {
    id: 107,
    created_at: now - hours(1),
    access_key_id: 1,
    block_id: 'openai-main',
    upstream_key_id: 11,
    model: 'gpt-4o',
    ip: '10.2.8.14',
    user_agent: 'aequi-sdk/1.2',
    status: 'success',
    error_detail: null,
    duration_ms: 990,
    prompt_tokens: 2410,
    completion_tokens: 720,
    cache_tokens: 256,
    estimated: false,
    credits: '0.0578',
  },
  {
    id: 108,
    created_at: now - hours(2),
    access_key_id: 3,
    block_id: 'anthropic-main',
    upstream_key_id: 13,
    model: 'claude-sonnet-4-5',
    ip: '10.2.9.7',
    user_agent: 'curl/8.4',
    status: 'success',
    error_detail: null,
    duration_ms: 1540,
    prompt_tokens: 4100,
    completion_tokens: 1250,
    cache_tokens: 0,
    estimated: false,
    credits: '0.1080',
  },
  {
    id: 109,
    created_at: now - hours(4),
    access_key_id: 2,
    block_id: 'openai-main',
    upstream_key_id: 12,
    model: 'gpt-4o-mini',
    ip: '10.2.8.51',
    user_agent: 'python-httpx/0.27',
    status: 'error',
    error_detail: '402 insufficient_credits：密钥余额为零',
    duration_ms: 30,
    prompt_tokens: 0,
    completion_tokens: 0,
    cache_tokens: 0,
    estimated: false,
    credits: '0.0000',
  },
  {
    id: 110,
    created_at: now - hours(7),
    access_key_id: 1,
    block_id: 'openai-main',
    upstream_key_id: 11,
    model: 'gpt-4o',
    ip: '10.2.8.14',
    user_agent: 'aequi-sdk/1.2',
    status: 'success',
    error_detail: null,
    duration_ms: 760,
    prompt_tokens: 1500,
    completion_tokens: 330,
    cache_tokens: 0,
    estimated: false,
    credits: '0.0250',
  },
];
