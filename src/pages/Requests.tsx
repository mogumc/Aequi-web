import { useEffect, useState, useRef } from 'react'
import {
  Card, CardContent, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Alert, Snackbar,
  Chip, Tooltip, IconButton, TextField, Switch, FormControlLabel,
} from '@mui/material'
import {
  Refresh as RefreshIcon, Stop as StopIcon, PlayArrow as PlayIcon,
} from '@mui/icons-material'
import { api, getAdminToken } from '../api/client'

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
  const [streamStatus, setStreamStatus] = useState<'disconnected' | 'connecting' | 'streaming'>('disconnected')
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isConnectingRef = useRef(false)
  const streamingRef = useRef(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.getRequests(200)
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

  const startStream = async () => {
    // 防止重复连接
    if (isConnectingRef.current || streamingRef.current) return

    // 先终止已有连接
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }

    // 实时流与自动刷新互斥，启用实时流时关闭自动刷新
    if (autoRefresh) {
      setAutoRefresh(false)
    }

    isConnectingRef.current = true
    setStreamStatus('connecting')

    const controller = new AbortController()
    abortRef.current = controller
    const token = getAdminToken()

    try {
      const res = await fetch('/admin/api/v1/requests/stream', {
        headers: token ? { 'X-Admin-Token': token } : {},
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`Stream ${res.status}`)

      streamingRef.current = true
      setStreamStatus('streaming')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done || controller.signal.aborted) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data:'))
          if (dataLine) {
            try {
              const item = JSON.parse(dataLine.slice(5).trim()) as RequestItem
              setRequests(prev => [item, ...prev].slice(0, 200))
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError('实时流断开，3秒后自动重连…')
        streamingRef.current = false
        setStreamStatus('disconnected')
        setTimeout(() => { if (!controller.signal.aborted) startStream() }, 3000)
      }
    } finally {
      isConnectingRef.current = false
      if (controller.signal.aborted) {
        streamingRef.current = false
        setStreamStatus('disconnected')
      }
    }
  }

  const stopStream = () => {
    abortRef.current?.abort()
    abortRef.current = null
    streamingRef.current = false
    setStreamStatus('disconnected')
    isConnectingRef.current = false
  }

  useEffect(() => () => { abortRef.current?.abort() }, [])

  const statusColor = (s: number) => s >= 200 && s < 300 ? 'success' : s >= 400 && s < 500 ? 'warning' : s >= 500 ? 'error' : 'default'

  const formatTokens = (r: RequestItem) => {
    if (r.total_tokens != null) return `${r.prompt_tokens ?? 0}/${r.completion_tokens ?? 0}/${r.total_tokens}`
    return '-'
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">请求历史</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title={streamStatus !== 'disconnected' ? '实时流运行中，自动刷新已禁用' : ''}>
                <FormControlLabel
                  control={<Switch size="small" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} disabled={streamStatus !== 'disconnected'} />}
                  label="自动刷新"
                />
              </Tooltip>
              <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>刷新</Button>
              {streamStatus === 'streaming' ? (
                <Button color="warning" startIcon={<StopIcon />} onClick={stopStream}>停止实时</Button>
              ) : streamStatus === 'connecting' ? (
                <Button disabled startIcon={<RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} />}>连接中…</Button>
              ) : (
                <Button variant="outlined" startIcon={<PlayIcon />} onClick={startStream}>实时流</Button>
              )}
            </Box>
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
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography sx={{ color: 'text.secondary', py: 4 }}>暂无请求记录</Typography>
                    </TableCell>
                  </TableRow>
                ) : requests.map(r => (
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
            共 {requests.length} 条记录 | 点击行查看详情
          </Typography>
        </CardContent>
      </Card>

      {/* Detail */}
      {selected && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">请求详情</Typography>
              <Button size="small" onClick={() => setSelected(null)}>关闭</Button>
            </Box>
            <Box component="pre" sx={{
              fontFamily: 'monospace', fontSize: 12, bgcolor: 'grey.50', p: 2,
              borderRadius: 1, overflow: 'auto', maxHeight: 400, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {JSON.stringify(selected, null, 2)}
            </Box>
          </CardContent>
        </Card>
      )}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
