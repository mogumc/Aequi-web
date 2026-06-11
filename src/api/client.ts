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
  requests_total: number
  requests_inflight: number
  rps: number
  responses_2xx: number
  responses_3xx: number
  responses_4xx: number
  responses_5xx: number
  errors_timeout: number
  errors_network: number
  latency_avg_ms: number
  latency_max_ms: number
  queue_depth: number
  queue_enabled: boolean
  upstreams: UpstreamStats[]
}

export interface Upstream {
  id: string
  base_url: string
  weight: number
  format: string
  proxy: string | null
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
}

export interface Config {
  [key: string]: unknown
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
  createUpstream: (data: { id: string; base_url: string; weight?: number; format?: string; proxy?: string }) =>
    request<Upstream>('/upstreams', { method: 'POST', body: JSON.stringify(data) }),
  updateUpstream: (id: string, data: Partial<Upstream>) =>
    request<Upstream>(`/upstreams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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

  // System
  reload: () => request<{ ok: boolean }>('/reload', { method: 'POST' }),
}
