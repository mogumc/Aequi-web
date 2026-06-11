import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Card, CardContent, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Alert, Snackbar,
  Chip, Switch, FormControlLabel, Divider, Grid,
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

function DetailLabel({ label, value, mono, highlight }: { label: string; value: React.ReactNode; mono?: boolean; highlight?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
        {label}
      </Typography>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Typography
          variant="body2"
          sx={{
            fontFamily: mono ? 'monospace' : undefined,
            fontSize: mono ? 12 : undefined,
            fontWeight: highlight ? 700 : 400,
            color: highlight ? 'primary.main' : 'text.primary',
            wordBreak: 'break-all',
          }}
        >
          {value}
        </Typography>
      ) : (
        <Box sx={{ mt: 0.25 }}>{value}</Box>
      )}
    </Box>
  )
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
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  req_bytes: number
  resp_bytes: number
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async (reqLimit?: number) => {
    const n = reqLimit ?? limit
    setLoading(true)
    try {
      const res = await api.getRequests(n)
      const list = Array.isArray(res?.requests) ? res.requests : []
      setRequests(list as RequestItem[])
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
    setLoading(false)
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
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>时间</TableCell>
                  <TableCell>客户端</TableCell>
                  <TableCell>模型</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>延迟</TableCell>
                  <TableCell>Token</TableCell>
                  <TableCell>上游</TableCell>
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
                    <TableCell>
                      <Typography variant="caption">{new Date(r.ts_ms).toLocaleTimeString()}</Typography>
                    </TableCell>
                    <TableCell><Typography sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.client_ip ?? '-'}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{r.model ?? '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={r.status} color={statusColor(r.status) as any} variant="outlined" />
                    </TableCell>
                    <TableCell>{r.latency_ms ?? 0}ms</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{formatTokens(r)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{r.upstream_id ?? '-'}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            共 {filteredRequests.length} / {requests.length} 条记录 | 点击行查看详情
          </Typography>
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
              <Box
                component="pre"
                sx={{
                  fontFamily: 'monospace', fontSize: 12,
                  bgcolor: 'background.default', color: 'text.primary',
                  p: 2, borderRadius: 1, overflow: 'auto', maxHeight: 400,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  border: '1px solid', borderColor: 'divider',
                }}
              >
                {JSON.stringify(selected, null, 2)}
              </Box>
            ) : (
              <Box>
                {/* 基本信息 */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
                  基本信息
                </Typography>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <DetailLabel label="请求 ID" value={`#${selected.id}`} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <DetailLabel label="时间" value={new Date(selected.ts_ms).toLocaleString()} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <DetailLabel label="客户端 IP" value={selected.client_ip ?? '-'} mono />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <DetailLabel
                      label="状态码"
                      value={
                        <Chip
                          size="small"
                          label={selected.status}
                          color={statusColor(selected.status) as any}
                          variant="filled"
                          sx={{ fontWeight: 700, minWidth: 48 }}
                        />
                      }
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 1.5 }} />

                {/* 请求信息 */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
                  请求信息
                </Typography>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 4, sm: 2 }}>
                    <DetailLabel label="方法" value={<MethodChip method={selected.method} />} />
                  </Grid>
                  <Grid size={{ xs: 8, sm: 5 }}>
                    <DetailLabel label="路径" value={selected.path} mono />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <DetailLabel label="模型" value={selected.model ?? '-'} mono />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <DetailLabel label="请求大小" value={formatBytes(selected.req_bytes)} />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 1.5 }} />

                {/* 响应信息 */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
                  响应信息
                </Typography>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <DetailLabel label="延迟" value={`${selected.latency_ms ?? 0} ms`} highlight />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <DetailLabel label="响应大小" value={formatBytes(selected.resp_bytes)} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <DetailLabel label="Prompt Tokens" value={selected.prompt_tokens != null ? selected.prompt_tokens.toLocaleString() : '-'} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <DetailLabel label="Completion Tokens" value={selected.completion_tokens != null ? selected.completion_tokens.toLocaleString() : '-'} />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 1.5 }} />

                {/* 上游信息 */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
                  上游信息
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailLabel label="上游 ID" value={selected.upstream_id ?? '未路由'} mono />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailLabel
                      label="总 Tokens"
                      value={
                        selected.total_tokens != null ? (
                          <Chip
                            size="small"
                            label={selected.total_tokens.toLocaleString()}
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 600 }}
                          />
                        ) : '-'
                      }
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
