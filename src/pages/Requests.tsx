import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Card, CardContent, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Alert, Snackbar,
  Chip, Switch, FormControlLabel,
  Select, MenuItem, InputLabel, FormControl, TextField,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Code as CodeIcon, ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { api } from '../api/client'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function MethodChip({ method }: { method: string }) {
  const colorMap: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
    GET: 'success',
    POST: 'info',
    PUT: 'warning',
    PATCH: 'warning',
    DELETE: 'error',
  }
  return (
    <Chip
      size="small"
      label={method}
      color={colorMap[method] ?? 'default'}
      variant="filled"
      sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 11, minWidth: 48 }}
    />
  )
}

interface RequestItem {
  id: number
  ts_ms: number
  client_ip: string
  method: string
  path: string
  model: string | null
  status: number
  latency_ms: number
  upstream_id: string | null
  billing_key?: string | null
  is_stream?: boolean
  prompt_tokens: number | null
  completion_tokens: number | null
  thought_tokens?: number | null
  total_tokens: number | null
  req_bytes: number
  resp_bytes: number
  request_headers?: unknown
  request_body?: unknown
  timing?: {
    queue_ms: number
    upstream_ms: number
    total_ms: number
    attempts: number
  }
}

export default function Requests() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [snack, setSnack] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selected, setSelected] = useState<RequestItem | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [limit, setLimit] = useState(200)
  const [filterText, setFilterText] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [historyEnd, setHistoryEnd] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async (reqLimit?: number) => {
    const n = reqLimit ?? limit
    setLoading(true)
    try {
      const res = await api.getRequests(n)
      const list = Array.isArray(res?.requests) ? res.requests : []
      setRequests(list as RequestItem[])
      setHistoryEnd(false)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
    setLoading(false)
  }

  const loadMore = async () => {
    if (loadingMore || requests.length === 0) return
    const oldest = requests[requests.length - 1]
    setLoadingMore(true)
    try {
      const res = await api.getRequestHistory(limit, oldest.ts_ms)
      const list = Array.isArray(res?.requests) ? res.requests : []
      if (list.length === 0) {
        setHistoryEnd(true)
      } else {
        setRequests(prev => [...prev, ...list as RequestItem[]])
      }
    } catch (e: any) {
      setError(e?.message ?? '加载历史失败')
    }
    setLoadingMore(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (autoRefresh) {
      timerRef.current = setInterval(load, 5000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh])

  const statusColor = (s: number) => s >= 200 && s < 300 ? 'success' : s >= 400 && s < 500 ? 'warning' : s >= 500 ? 'error' : 'default'

  const formatTokens = (r: RequestItem) => {
    if (r.total_tokens != null) return `${r.prompt_tokens ?? 0}/${r.completion_tokens ?? 0}/${r.total_tokens}`
    return '-'
  }

  const filteredRequests = useMemo(() => {
    if (!filterText.trim()) return requests
    const kw = filterText.trim().toLowerCase()
    return requests.filter(r =>
      String(r.id).includes(kw) ||
      (r.client_ip ?? '').toLowerCase().includes(kw) ||
      (r.method ?? '').toLowerCase().includes(kw) ||
      (r.path ?? '').toLowerCase().includes(kw) ||
      (r.model ?? '').toLowerCase().includes(kw) ||
      String(r.status).includes(kw) ||
      String(r.latency_ms).includes(kw) ||
      (r.upstream_id ?? '').toLowerCase().includes(kw)
    )
  }, [requests, filterText])

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">请求历史</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Button size="small" startIcon={<RefreshIcon />} onClick={() => load()} disabled={loading}>刷新</Button>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            <TextField
              size="small" placeholder="搜索客户端IP/模型/上游/路径…"
              value={filterText} onChange={e => setFilterText(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.secondary', fontSize: 20 }} />,
                },
              }}
              sx={{ minWidth: 200, flex: '1 1 200px' }}
            />
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <InputLabel>条数</InputLabel>
              <Select
                label="条数"
                value={limit}
                onChange={e => { const v = Number(e.target.value); setLimit(v); load(v) }}
              >
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={200}>200</MenuItem>
                <MenuItem value={500}>500</MenuItem>
                <MenuItem value={1000}>1000</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch size="small" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />}
              label="自动刷新"
              sx={{ ml: 0 }}
            />
          </Box>

          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader sx={{ '& td:not(:nth-of-type(4))': { fontFamily: 'monospace', fontSize: 13, fontWeight: 600 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>时间</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>客户端</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>模型</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>状态</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>延迟</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Token</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>上游</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography sx={{ color: 'text.secondary', py: 4 }}>{filterText ? '无匹配记录' : '暂无请求记录'}</Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.map(r => (
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                    <TableCell>{new Date(r.ts_ms).toLocaleTimeString()}</TableCell>
                    <TableCell>{r.client_ip ?? '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        {r.model ?? '-'}
                        {r.is_stream && <Chip size="small" label="流" color="info" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={r.status} color={statusColor(r.status) as any} variant="outlined" />
                    </TableCell>
                    <TableCell>{r.latency_ms ?? 0}ms</TableCell>
                    <TableCell>{formatTokens(r)}</TableCell>
                    <TableCell>{r.upstream_id ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              共 {filteredRequests.length} / {requests.length} 条记录 | 点击行查看详情
            </Typography>
            <Button size="small" onClick={loadMore} disabled={loadingMore || historyEnd || !!filterText}
              sx={{ textTransform: 'none' }}>
              {loadingMore ? '加载中...' : historyEnd ? '已加载全部' : '加载更多'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Detail */}
      {selected && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">请求详情</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={showRaw ? <ExpandLessIcon /> : <CodeIcon />}
                  onClick={() => setShowRaw(!showRaw)}
                  sx={{ textTransform: 'none' }}
                >
                  {showRaw ? '收起' : '原始 JSON'}
                </Button>
                <Button size="small" onClick={() => { setSelected(null); setShowRaw(false) }}>关闭</Button>
              </Box>
            </Box>

            {showRaw ? (
              <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: 12, bgcolor: 'background.default', color: 'text.primary', p: 2, borderRadius: 1, overflow: 'auto', maxHeight: 400, whiteSpace: 'pre-wrap', wordBreak: 'break-all', border: '1px solid', borderColor: 'divider' }}>
                {JSON.stringify(selected, null, 2)}
              </Box>
            ) : (
              <Table size="small" sx={{ '& td': { border: 'none', py: 0.5, px: 1, fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }, '& td:first-of-type': { color: 'text.secondary', fontWeight: 600 }, '& td:nth-of-type(3)': { color: 'text.secondary', fontWeight: 600 } }}>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', width: 140 }}>请求 ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>#{selected.id}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', width: 100 }}>时间</TableCell>
                    <TableCell>{new Date(selected.ts_ms).toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary' }}>客户端 IP</TableCell>
                    <TableCell>{selected.client_ip ?? '-'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>状态码</TableCell>
                    <TableCell>
                      <Chip size="small" label={selected.status} color={statusColor(selected.status) as any} variant="filled" sx={{ fontWeight: 700, minWidth: 48 }} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider' }}>方法</TableCell>
                    <TableCell sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <MethodChip method={selected.method} />
                        {selected.is_stream && <Chip size="small" label="流" color="info" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider' }}>路径</TableCell>
                    <TableCell sx={{ borderTop: '1px solid', borderColor: 'divider', wordBreak: 'break-all' }}>{selected.path}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary' }}>模型</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        {selected.model ?? '-'}
                        {selected.is_stream && <Chip size="small" label="流" color="info" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>请求大小</TableCell>
                    <TableCell>{formatBytes(selected.req_bytes)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider' }}>延迟</TableCell>
                    <TableCell sx={{ borderTop: '1px solid', borderColor: 'divider' }}>{selected.latency_ms ?? 0} ms</TableCell>
                    <TableCell sx={{ color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider' }}>响应大小</TableCell>
                    <TableCell sx={{ borderTop: '1px solid', borderColor: 'divider' }}>{formatBytes(selected.resp_bytes)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary' }}>输入</TableCell>
                    <TableCell>{selected.prompt_tokens != null ? `${selected.prompt_tokens.toLocaleString()} tokens` : '-'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>输出</TableCell>
                    <TableCell>{selected.completion_tokens != null ? `${selected.completion_tokens.toLocaleString()} tokens` : '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider' }}>上游 ID</TableCell>
                    <TableCell sx={{ borderTop: '1px solid', borderColor: 'divider' }}>{selected.upstream_id ?? '未路由'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider' }}>总 Tokens</TableCell>
                    <TableCell sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                      {selected.total_tokens != null ? (
                        <Chip size="small" label={selected.total_tokens.toLocaleString()} color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
