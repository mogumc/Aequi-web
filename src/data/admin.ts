// EXPORTS: IHealth, ILoginResponse, IProvider, IAdminAccount, IDeviceInfo, IOtpStatus, ISystemSettings, IAccessKey, IKeyListResponse, IBlockHeader, IBlockModel, IBlockInput, IUpstreamBlock, IUpstreamKey, IKeySelf, IUsageSummary, IUsageRecord, IKeyUsage, IRequestLog, IDashboardToday, IDashboardError, IDashboardLowCreditKey, IDashboardLowCredits, IDashboardHourlyPoint, IDashboardStats

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
  /**
   * 额外请求体：只允许管理端配置，下游请求体里的同名键会被丢弃。
   *
   * 按上游格式书写（块绑的是哪家就写哪家），顶层浅合并进发往上游的请求体。
   * 网关掌管的键（model / messages / stream 等）不许覆盖，后端会拒。
   */
  extra_body?: Record<string, unknown>;
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
  /** 同时发往该上游的请求数上限。0 = 不限制（缺省），最大 1024。 */
  max_concurrency?: number;
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
  /** 同时发往该上游的请求数上限。0 = 不限制；达到上限后新请求排队。 */
  max_concurrency?: number;
  /** 正在发往上游的请求数（读取瞬间的快照）；不限制并发时为 null。 */
  in_flight?: number | null;
  /** 排在并发闸门后的请求数（快照）；持续大于 0 说明上限打满。 */
  queued?: number | null;
  created_at?: number;
  updated_at?: number;
}

export interface IUpstreamKey {
  /** 上游密钥 id：后端是随机字符串，不是数字。 */
  id: string;
  block_id: string;
  secret: string;
  status: 'active' | 'paused' | 'disabled';
  /**
   * 免于被**自动停用**（连续硬失败够次数也不停）。
   *
   * 只免自动停用这一个动作：429 的退避照常（那是临时避让，不是停用），
   * 上游 5xx 本来就不动密钥状态；手动暂停/恢复不受影响，
   * 手动测试确认无效仍然停用。
   */
  never_disable: boolean;
  /** 块内调度权重（块内多把密钥按平滑加权轮询分配）。 */
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

// ---- 首页看板（GET /api/stats/dashboard）----
//
// 这些数字全在服务端算好再回来：以前首页拉 500 条日志自己过滤，窗口既不是
// 「当日」，也把 IP、UA、重试链这些用不上的字段搬进了浏览器。

/** 今日请求计数（本地时区当天 0 点起）。 */
export interface IDashboardToday {
  requests: number;
  success: number;
  failed: number;
}

/** 首页「最近错误」的一条，只带首页要显示的那几列。 */
export interface IDashboardError {
  id: number;
  created_at: number;
  model: string;
  block_id: string | null;
  /** 详细错误，可能含上游原话与整条重试链。 */
  error_detail: string | null;
}

/** 额度预警里的一把密钥。 */
export interface IDashboardLowCreditKey {
  id: string;
  name: string;
  /** 剩余积分，四位小数字符串。 */
  credits: string;
  credits_scaled: number;
}

/** 额度预警：命中总数与余额最低的几把明细。 */
export interface IDashboardLowCredits {
  /** 判定线（四位小数字符串）——由服务端定，界面直接显示，别在前端写死。 */
  threshold: string;
  threshold_scaled: number;
  /** 命中的总数；`keys` 只给最低的几把。 */
  count: number;
  keys: IDashboardLowCreditKey[];
}

/** 按整点统计的一个点。 */
export interface IDashboardHourlyPoint {
  /** 该小时的起点，Unix 秒（整点）。 */
  hour: number;
  requests: number;
  failed: number;
}

/** 首页看板快照。 */
export interface IDashboardStats {
  today: IDashboardToday;
  /** 最近几条失败，新的在前。 */
  recent_errors: IDashboardError[];
  keys: { total: number; enabled: number };
  low_credits: IDashboardLowCredits;
  /** 最近 24 个整点，从旧到新；最后一个桶是当前这一小时（未满）。 */
  hourly: IDashboardHourlyPoint[];
}
