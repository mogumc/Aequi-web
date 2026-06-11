import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Grid, Card, CardContent, Typography, Box, Chip, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Select, MenuItem, FormControl, InputLabel, Alert,
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon, Speed as SpeedIcon,
  CheckCircle as CheckIcon,
  Timer as TimerIcon, Refresh as RefreshIcon,
} from '@mui/icons-material'
import { api, Stats, MetricsBucket, getAdminToken } from '../api/client'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip, Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip, Legend)

function StatCard({ title, value, icon, sub }: {
  title: string; value: string | number; icon: React.ReactNode; sub?: string
}) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', color: 'text.primary', display: 'flex' }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </Box>
      </CardContent>
    </Card>
  )
}

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <Box sx={{ width: '100%' }}>
      <LinearProgress variant="determinate" value={pct} color={color as any}
        sx={{ height: 6, borderRadius: 3, bgcolor: 'grey.100' }} />
    </Box>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [buckets, setBuckets] = useState<MetricsBucket[]>([])
  const [metricWindow, setMetricWindow] = useState('1m')
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const connectSSE = useCallback(() => {
    if (!mountedRef.current) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const token = getAdminToken()
    fetch('/admin/api/v1/stats/stream', {
      headers: token ? { 'X-Admin-Token': token } : {},
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`SSE ${res.status}`)
      if (!res.body) throw new Error('SSE body is null')
      if (mountedRef.current) setError('')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done || !mountedRef.current) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            if (data) {
              try { setStats(JSON.parse(data)) } catch {}
            }
          }
        }
      }
    }).catch((e) => {
      if (e.name !== 'AbortError' && mountedRef.current) {
        setError('SSE 连接断开，正在重连...')
        setTimeout(connectSSE, 3000)
      }
    })
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connectSSE()
    api.getStats().then(d => { if (mountedRef.current) setStats(d) }).catch(() => {})
    api.getMetrics(metricWindow).then(d => { if (mountedRef.current) setBuckets(d?.buckets ?? []) }).catch(() => {})
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [connectSSE])

  useEffect(() => {
    api.getMetrics(metricWindow).then(d => { if (mountedRef.current) setBuckets(d?.buckets ?? []) }).catch(() => {})
  }, [metricWindow])

  const totalErrors = (stats?.errors_network ?? 0) + (stats?.errors_timeout ?? 0)
  const successRate = (stats?.requests_total ?? 0) > 0
    ? (((stats?.responses_2xx ?? 0) / (stats?.requests_total ?? 1)) * 100).toFixed(1)
    : '0.0'

  const safeUpstreams = Array.isArray(stats?.upstreams) ? stats.upstreams : []

  return (
    <Box>
      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 4 }}>
          <StatCard title="RPM" value={stats?.rpm?.toFixed(0) ?? '0'} icon={<SpeedIcon />} sub="请求/分钟" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 4 }}>
          <StatCard title="成功率" value={`${successRate}%`} icon={<CheckIcon />} sub={`${stats?.responses_4xx ?? 0} 4xx / ${stats?.responses_5xx ?? 0} 5xx`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 4 }}>
          <StatCard title="平均延迟" value={`${stats?.latency_avg_ms?.toFixed(0) ?? '0'}ms`} icon={<TimerIcon />} sub={`${totalErrors} 错误`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 4 }}>
          <StatCard title="总请求" value={(stats?.requests_total ?? 0).toLocaleString()} icon={<TrendingUpIcon />} sub={`${formatUptime(stats?.uptime_s ?? 0)} 运行`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 4 }}>
          <StatCard title="总 Token" value={(stats?.tokens_total ?? 0).toLocaleString()} icon={<TrendingUpIcon />} sub={`输入 ${(stats?.prompt_tokens_total ?? 0).toLocaleString()} / 输出 ${(stats?.completion_tokens_total ?? 0).toLocaleString()}`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 4 }}>
          <StatCard title="进行中" value={stats?.requests_inflight ?? 0} icon={<TrendingUpIcon />} sub={`队列 ${stats?.queue_depth ?? 0}`} />
        </Grid>
      </Grid>

      {/* Upstreams Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">上游状态</Typography>
            <Tooltip title="刷新">
              <IconButton size="small" onClick={() => api.getStats().then(setStats)}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          {safeUpstreams.length === 0 ? (
            <Typography color="text.secondary" variant="body2">暂无上游数据</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>上游</TableCell>
                    <TableCell>请求数</TableCell>
                    <TableCell>2xx</TableCell>
                    <TableCell>4xx/5xx</TableCell>
                    <TableCell>错误</TableCell>
                    <TableCell>密钥</TableCell>
                    <TableCell>负载</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {safeUpstreams.map(us => {
                    const maxSel = Math.max(...safeUpstreams.map(u => u.selected_total ?? 0), 1)
                    return (
                      <TableRow key={us.id}>
                        <TableCell><Typography sx={{ fontWeight: 500 }}>{us.id}</Typography></TableCell>
                        <TableCell>{(us.selected_total ?? 0).toLocaleString()}</TableCell>
                        <TableCell>{us.responses_2xx ?? 0}</TableCell>
                        <TableCell>
                          <Chip size="small" label={`${us.responses_4xx ?? 0}/${us.responses_5xx ?? 0}`}
                            color={(us.responses_5xx ?? 0) > 0 ? 'error' : 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell>{(us.errors_network ?? 0) + (us.errors_timeout ?? 0)}</TableCell>
                        <TableCell>
                          <Tooltip title={`${us.keys_invalid ?? 0} 无效`}>
                            <span>{us.keys_active ?? 0}/{us.keys_total ?? 0}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ minWidth: 100 }}>
                          <MiniBar value={us.selected_total ?? 0} max={maxSel} color="primary" />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Metrics Chart */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">请求趋势</Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>时间窗口</InputLabel>
              <Select value={metricWindow} label="时间窗口" onChange={e => { setMetricWindow(e.target.value); api.getMetrics(e.target.value).then(d => { if (mountedRef.current) setBuckets(d?.buckets ?? []) }).catch(() => {}) }}>
                <MenuItem value="1m">1 分钟</MenuItem>
                <MenuItem value="5m">5 分钟</MenuItem>
                <MenuItem value="30m">30 分钟</MenuItem>
                <MenuItem value="1h">1 小时</MenuItem>
              </Select>
            </FormControl>
          </Box>
          {buckets.length === 0 ? (
            <Typography color="text.secondary" variant="body2">暂无指标数据</Typography>
          ) : (
            <Box sx={{ height: 250 }}>
              <Line
                data={{
                  labels: buckets.map(b => {
                    const d = new Date(b.ts_ms)
                    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
                  }),
                  datasets: [
                    {
                      label: '总请求',
                      data: buckets.map(b => b.total ?? 0),
                      borderColor: '#1976d2',
                      backgroundColor: 'rgba(25,118,210,0.1)',
                      fill: true,
                      tension: 0.3,
                      pointRadius: buckets.length > 30 ? 0 : 3,
                      pointHoverRadius: 5,
                    },
                    {
                      label: '成功',
                      data: buckets.map(b => b.success ?? 0),
                      borderColor: '#2e7d32',
                      backgroundColor: 'transparent',
                      borderDash: [4, 2],
                      tension: 0.3,
                      pointRadius: 0,
                    },
                    {
                      label: '失败',
                      data: buckets.map(b => b.failure ?? 0),
                      borderColor: '#d32f2f',
                      backgroundColor: 'rgba(211,47,47,0.1)',
                      fill: true,
                      tension: 0.3,
                      pointRadius: 0,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } },
                    tooltip: {
                      callbacks: {
                        title: (items) => items[0]?.label ?? '',
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { maxTicksLimit: 12, font: { size: 11 } },
                    },
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(0,0,0,0.05)' },
                      ticks: { font: { size: 11 } },
                    },
                  },
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
