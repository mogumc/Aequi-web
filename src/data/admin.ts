// EXPORTS: IHealth, ILoginResponse, IProvider, IAdminAccount, IDeviceInfo, IOtpStatus, ISystemSettings, IAccessKey, IKeyListResponse, IBlockHeader, IBlockModel, IBlockInput, IUpstreamBlock, IUpstreamKey, IKeySelf, IUsageSummary, IUsageRecord, IKeyUsage, IRequestLog

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
  /** 累计输入 token（含缓存命中的部分）。 */
  prompt_tokens: number;
  /** 累计输出 token。 */
  completion_tokens: number;
  /** 累计命中缓存的输入 token。 */
  cache_tokens: number;
  credits: string;
  credits_scaled: number;
}

export interface IUsageRecord {
  id: number;
  model: string;
  /**
   * 这次实际命中的上游块（路由快照）。
   *
   * 只写模型名的请求会在提供它的块之间轮询，落点只有执行时才知道。
   * `null` 有两种情形：老记录，或「选中块之前」就失败的请求。
   */
  block_id: string | null;
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
  /** 是否还有更早的记录；把最后一条的 id 传给 before_id 取下一页。 */
  has_more: boolean;
  /** 日志保留天数——汇总与明细都只是这段窗口内的数据。 */
  retention_days?: number;
}

/** 密钥侧可用模型路由（脱敏视图：无转发名与上游细节）。 */
export interface IKeyModel {
  block_id: string;
  model: string;
  /** 计费倍率，两位小数字符串。 */
  multiplier: string;
}

// ---- 上游块 ----

export interface IBlockModel {
  name: string;
  forward?: string;
  /** 计费倍率，万分比整数（10000 = 1.0 倍）。倍率跟着模型走，模型属于块。 */
  multiplier_bp?: number;
}

/**
 * 块的自定义请求头：每次发往该上游的请求都会带上。
 *
 * 有些上游（自建网关、中转站、企业版接口）要额外的头才肯干活：版本头、
 * 租户/组织头、网关自己的路由头，或者认证压根不是标准那三种写法。
 * 明文存取——与上游密钥同一套取舍，管理员要能取回来核对。
 */
export interface IBlockHeader {
  name: string;
  value: string;
}

export interface IBlockInput {
  id?: string;
  name: string;
  api_format: 'openai' | 'google' | 'anthropic';
  weight: number;
  base_url: string;
  proxy: string | null;
  models: IBlockModel[];
  /** 整份提交：传空数组就是清空（后端不做按名字的增量合并）。 */
  headers: IBlockHeader[];
}

export interface IUpstreamBlock {
  id: string;
  name: string;
  api_format: 'openai' | 'google' | 'anthropic';
  weight: number;
  base_url: string;
  proxy: string | null;
  models: IBlockModel[];
  /** 自定义请求头，空数组表示不加。 */
  headers: IBlockHeader[];
  /** 停用的块不参与调度。 */
  enabled: boolean;
  key_count?: number;
  available_keys?: number;
  created_at?: number;
  updated_at?: number;
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
  /** 是否流式请求。 */
  stream: boolean;
  credits: string;
}
