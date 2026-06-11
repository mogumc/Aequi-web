// API client for gptload-rs admin API

const BASE = '/admin/api/v1'

let adminToken = localStorage.getItem('admin_token') || ''

export function setAdminToken(token: string) {
  adminToken = token
  localStorage.setItem('admin_token', token)
}

export function getAdminToken() {
  return adminToken
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (adminToken) {
    headers['X-Admin-Token'] = adminToken
  }
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.text() as unknown as T
}

// --- Types (matched to real API responses) ---

export interface UpstreamStats {
  id: string
  base_url: string
  format: string
  proxy: string | null
  weight: number
  max_concurrent_per_key: number | null
  keys_total: number
  keys_active: number
  keys_invalid: number
  selected_total: number
  responses_2xx: number
  responses_3xx: number
  responses_4xx: number
  responses_5xx: number
  errors_timeout: number
  errors_network: number
}

export interface Stats {
  ts_ms: number
  uptime_s: number
  max_retries: number
  retry_status_codes?: number[]
  requests_total: number
  requests_inflight: number
  rpm?: number
  upstream_selected_total?: number
  responses_2xx: number
  responses_3xx: number
  responses_4xx: number
  responses_5xx: number
  errors_timeout: number
  errors_network: number
  latency_avg_ms: number
  latency_max_ms: number
  latency_count?: number
  queue_depth: number
  queue_enabled: boolean
  prompt_tokens_total?: number
  completion_tokens_total?: number
  tokens_total?: number
  upstreams: UpstreamStats[]
}

export interface Upstream {
  id: string
  base_url: string
  weight: number
  format: string
  proxy: string | null
  max_concurrent_per_key: number | null
  model_map: Record<string, string> | null
  min_key_level: number | null
  keys_total: number
  keys_active: number
  keys_invalid: number
  selected_total: number
  responses_2xx: number
  responses_3xx: number
  responses_4xx: number
  responses_5xx: number
  errors_timeout: number
  errors_network: number
}

export interface KeyItem {
  key: string
  status: string
  active_requests: number
  failure_count: number
  cooldown_until_ms: number
  latency_p50_ms: number | null
  latency_p90_ms: number | null
  latency_p99_ms: number | null
}

export interface MetricsBucket {
  ts_ms: number
  total: number
  success: number
  failure: number
  ignored: number
}

export interface MetricsResponse {
  window: string
  now_ms: number
  buckets: MetricsBucket[]
}

export interface ModelRoutesResponse {
  updated_at_ms: number
  models: Record<string, string[]>
  upstreams: Record<string, string[]>
}

export interface BillingKey {
  key: string
  balance: number
  created_at?: string
  level?: number
}

export interface Config {
  [key: string]: unknown
}

export type ModelCosts = Record<string, { input: number; output: number }>

export interface BillingOverview {
  billing: {
    total_keys: number
    unlimited_keys: number
    active_keys: number
    exhausted_keys: number
    total_balance: number
  }
  model_costs: { model: string; input: number; output: number }[]
  upstreams: {
    id: string
    total_keys: number
    active_keys: number
    format: string
    min_key_level: number
    model_map: string[]
  }[]
  requests_total: number
  requests_inflight: number
}

// --- API Functions ---

export const api = {
  // Health
  health: () => request<Record<string, unknown>>('/health'),

  // Stats
  getStats: () => request<Stats>('/stats'),
  getMetrics: (window: 'minute' | 'hour' | 'day' = 'hour') =>
    request<MetricsResponse>(`/metrics?window=${window}`),
  getRequests: (limit = 50) =>
    request<{ count: number; now_ms: number; requests: unknown[] }>(`/requests?limit=${limit}`),
  getConfig: () => request<Config>('/config'),

  // Upstreams
  getUpstreams: () => request<Upstream[]>('/upstreams'),
  createUpstream: (data: { id: string; base_url: string; weight?: number; format?: string; proxy?: string; model_map?: Record<string, string>; min_key_level?: number }) =>
    request<{ ok: boolean; upstreams: number }>('/upstreams', { method: 'POST', body: JSON.stringify(data) }),
  updateUpstream: (id: string, data: Partial<Upstream>) =>
    request<{ ok: boolean }>(`/upstreams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUpstream: (id: string, deleteKeys = false) =>
    request<void>(`/upstreams/${id}${deleteKeys ? '?delete_keys=1' : ''}`, { method: 'DELETE' }),

  // Keys
  getKeys: (upstreamId: string, offset = 0, limit = 50) =>
    request<{ keys: KeyItem[]; total: number; offset: number; limit: number; upstream: string }>(
      `/upstreams/${upstreamId}/keys?offset=${offset}&limit=${limit}`
    ),
  addKeys: (upstreamId: string, keys: string) =>
    request<{ added: number }>(`/upstreams/${upstreamId}/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: keys,
    }),
  replaceKeys: (upstreamId: string, keys: string) =>
    request<{ replaced: number }>(`/upstreams/${upstreamId}/keys`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: keys,
    }),
  deleteKeys: (upstreamId: string, keys: string[]) =>
    request<void>(`/upstreams/${upstreamId}/keys`, {
      method: 'DELETE',
      body: JSON.stringify({ keys }),
    }),
  releaseKeys: (upstreamId: string, keys?: string[]) =>
    request<void>(`/upstreams/${upstreamId}/keys/release`, {
      method: 'POST',
      body: JSON.stringify(keys ? { keys } : { all: true }),
    }),
  invalidateKeys: (upstreamId: string, keys?: string[]) =>
    request<void>(`/upstreams/${upstreamId}/keys/invalidate`, {
      method: 'POST',
      body: JSON.stringify(keys ? { keys } : { all: true }),
    }),
  testKey: (upstreamId: string, key: string) =>
    request<{ ok: boolean; latency_ms?: number; error?: string }>(`/upstreams/${upstreamId}/keys/test`, {
      method: 'POST',
      body: JSON.stringify({ key }),
    }),

  // Models
  getModelRoutes: () => request<ModelRoutesResponse>('/models/routes'),
  updateModelRoutes: (data: { upstreams: Record<string, string[]> }) =>
    request<ModelRoutesResponse>('/models/routes', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  refreshModels: (upstreamId: string) =>
    request<{ models: string[] }>(`/upstreams/${upstreamId}/models/refresh`, {
      method: 'POST',
    }),

  // Billing
  getBillingOverview: () => request<BillingOverview>('/billing/overview'),
  listBillingKeys: () =>
    request<{ keys: BillingKey[] }>('/billing/keys'),
  createBillingKey: (key: string, balance: number) =>
    request<BillingKey>('/billing/keys', { method: 'POST', body: JSON.stringify({ key, balance }) }),
  getBillingKey: (key: string) =>
    request<BillingKey>(`/billing/keys/${key}`),
  adjustBalance: (key: string, delta: number) =>
    request<BillingKey>(`/billing/keys/${key}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
    }),
  deleteBillingKey: (key: string) =>
    request<void>(`/billing/keys/${key}`, { method: 'DELETE' }),

  // System
  reload: () => request<{ ok: boolean }>('/reload', { method: 'POST' }),

  // Model Costs
  getModelCosts: () => request<ModelCosts>('/model-costs'),
  setModelCosts: (data: ModelCosts) =>
    request<{ ok: boolean }>('/model-costs', { method: 'POST', body: JSON.stringify(data) }),

  // Key Levels
  getKeyLevels: () => request<Record<string, number>>('/storage/key_levels'),
  setKeyLevels: (data: Record<string, number>) =>
    request<{ ok: boolean }>('/storage/key_levels', { method: 'POST', body: JSON.stringify(data) }),
  setBillingKeyLevel: (key: string, level: number) =>
    request<{ ok: boolean }>(`/billing/${key}/level`, { method: 'POST', body: JSON.stringify({ level }) }),
  getBillingKeyLevel: (key: string) =>
    request<{ key: string; level: number }>(`/billing/${key}/level`),
}
