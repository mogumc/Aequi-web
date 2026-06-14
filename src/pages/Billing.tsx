import { useState, useEffect } from 'react'
import {
  Card, CardContent, Typography, Box, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, Snackbar, IconButton, Tooltip, Grid, Chip,
} from '@mui/material'
import { Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Casino as GenerateIcon, Refresh as RefreshIcon, TrendingUp as LevelIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { api, BillingKey, type BillingOverview } from '../api/client'

function formatNum(n: number): string {
  if (n === 0) return '0'
  const units = ['', 'K', 'M', 'G', 'T']
  const k = 1000
  const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), units.length - 1)
  const val = n / Math.pow(k, i)
  if (i === 0) return val.toFixed(0)
  return val.toFixed(3).replace(/\.?0+$/, '') + units[i]
}

function formatCredits(n: number): string {
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000
    return v % 1 === 0 ? `${v.toFixed(0)}B` : `${v.toFixed(3).replace(/\.?0+$/, '')}B`
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return v % 1 === 0 ? `${v.toFixed(0)}M` : `${v.toFixed(3).replace(/\.?0+$/, '')}M`
  }
  if (n >= 1_000) {
    const v = n / 1_000
    return v % 1 === 0 ? `${v.toFixed(0)}K` : `${v.toFixed(3).replace(/\.?0+$/, '')}K`
  }
  return n.toFixed(6).replace(/\.?0+$/, '') || '0'
}

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const arr = new Uint8Array(48)
  crypto.getRandomValues(arr)
  return 'hs-' + Array.from(arr, b => chars[b % chars.length]).join('')
}

export default function Billing() {
  const [keys, setKeys] = useState<BillingKey[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [loadingSlow, setLoadingSlow] = useState(false)
  const [error, setError] = useState('')
  const [createDialog, setCreateDialog] = useState(false)
  const [adjustDialog, setAdjustDialog] = useState<BillingKey | null>(null)
  const [createForm, setCreateForm] = useState({ key: '', balance: '' as string | number, level: '' as string | number })
  const [adjustDelta, setAdjustDelta] = useState(0.001)
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('add')
  const [snack, setSnack] = useState('')
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [levelDialog, setLevelDialog] = useState<BillingKey | null>(null)
  const [levelForm, setLevelForm] = useState(0)
  const [deleteConfirm, setDeleteConfirm] = useState<BillingKey | null>(null)

  const loadKeys = () => {
    setError('')
    api.listBillingKeys().then(d => {
      setKeys(Array.isArray(d?.keys) ? d.keys : [])
    }).catch(() => {})
  }

  const reloadOverview = () => {
    setError('')
    api.getBillingOverview().then(d => { if (d && 'billing' in d) setOverview(d) }).catch(() => {})
  }

  useEffect(() => {
    setPageLoading(true)
    Promise.all([
      api.listBillingKeys().then(d => { setKeys(Array.isArray(d?.keys) ? d.keys : []) }).catch(() => {}),
      api.getBillingOverview().then(d => { if (d && 'billing' in d) setOverview(d) }).catch(() => {}),
    ]).finally(() => setPageLoading(false))
  }, [])

  useEffect(() => {
    if (!pageLoading) { setLoadingSlow(false); return }
    const t = setTimeout(() => setLoadingSlow(true), 4000)
    return () => clearTimeout(t)
  }, [pageLoading])

  const handleQuery = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const result = await api.getBillingKey(query.trim())
      if (result && typeof result === 'object' && result.key) {
        setKeys(prev => {
          const exists = prev.findIndex(k => k.key === result.key)
          if (exists >= 0) {
            const copy = [...prev]
            copy[exists] = result
            return copy
          }
          return [result, ...prev]
        })
      }
      setError('')
    } catch (e: any) {
      setError(e?.message ?? '操作失败')
    }
    setLoading(false)
  }

  const handleCreate = async () => {
    setError('')
    try {
      const balance = createForm.balance === '' ? 0 : Number(createForm.balance)
      await api.createBillingKey(createForm.key, balance)
      if (createForm.level !== '') {
        await api.setBillingKeyLevel(createForm.key, Number(createForm.level)).catch(() => {})
      }
      setCreateDialog(false)
      setCreateForm({ key: '', balance: '', level: '' })
      loadKeys()
      reloadOverview()
      setSnack('计费密钥已创建')
    } catch (e: any) {
      setError(e?.message ?? '操作失败')
    }
  }

  const handleAdjust = async () => {
    if (!adjustDialog) return
    setError('')
    const currentBalance = adjustDialog.balance ?? 0
    const delta = adjustMode === 'add' ? adjustDelta : -adjustDelta
    const newBalance = currentBalance + delta
    if (newBalance < 0) {
      setError('调整后余额不能小于 0')
      return
    }
    try {
      const result = await api.adjustBalance(adjustDialog.key, delta)
      if (result && typeof result === 'object' && result.key) {
        setKeys(prev => prev.map(k => k.key === result.key ? { ...k, balance: result.balance } : k))
      }
      setAdjustDialog(null)
      setAdjustDelta(0.001)
      reloadOverview()
      setAdjustMode('add')
      setSnack(adjustMode === 'add' ? '余额已增加' : '余额已扣除')
    } catch (e: any) {
      setError(e?.message ?? '操作失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setError('')
    try {
      await api.deleteBillingKey(deleteConfirm.key)
      setKeys(prev => prev.filter(k => k.key !== deleteConfirm.key))
      setDeleteConfirm(null)
      setSnack('计费密钥已删除')
      reloadOverview()
    } catch (e: any) {
      setError(e?.message ?? '删除失败')
    }
  }

  const handleSetLevel = async () => {
    if (!levelDialog) return
    setError('')
    try {
      await api.setBillingKeyLevel(levelDialog.key, levelForm)
      setLevelDialog(null)
      setSnack(levelForm === -1 ? '已设为无限制' : `等级已设为 ${levelForm}`)
      loadKeys()
      reloadOverview()
    } catch (e: any) {
      setError(e?.message ?? '设置等级失败')
    }
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {loadingSlow && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<RefreshIcon />}>
          加载中，如果长时间无响应，请检查后端服务是否正常运行
        </Alert>
      )}

      {/* Overview */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">费用概览</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              请求 {overview?.requests_total ?? '-'} | 进行中 {overview?.requests_inflight ?? '-'}
            </Typography>
            <Button size="small" startIcon={<RefreshIcon />} onClick={() => { loadKeys(); reloadOverview() }}>刷新</Button>
          </Box>
        </Box>
        {/* Stat cards */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, sm: 4, md: 4 }}>
            <Card>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">总密钥</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{overview?.billing?.total_keys ?? '-'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 4 }}>
            <Card>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">活跃</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{overview?.billing?.active_keys ?? '-'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 4 }}>
            <Card>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">无限额度</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{overview?.billing?.unlimited_keys ?? '-'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 4 }}>
            <Card>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">耗尽</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{overview?.billing?.exhausted_keys ?? '-'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 4 }}>
            <Card>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">余额</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'baseline', gap: 1, overflow: 'hidden' }}>
                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatCredits(overview?.billing?.total_balance ?? 0)}
                  </Box>
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400, flexShrink: 0 }}>
                    已用 {formatCredits(overview?.usage?.credits ?? 0)}
                  </Typography>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 4 }}>
            <Card>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">词元</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{overview?.usage?.tokens != null ? formatNum(overview.usage.tokens) : '-'}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Model costs */}
        <Box sx={{ mb: 2 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                模型倍率
                {overview && <Chip size="small" label={overview.model_costs.length} color="primary" variant="outlined" />}
              </Typography>
              {pageLoading ? (
                <Typography variant="body2" color="text.secondary">加载中...</Typography>
              ) : overview && overview.model_costs.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5 }}>模型</TableCell>
                      <TableCell sx={{ py: 0.5 }} align="right">输入倍率</TableCell>
                      <TableCell sx={{ py: 0.5 }} align="right">输出倍率</TableCell>
                      <TableCell sx={{ py: 0.5 }} align="right">按次计费</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {overview.model_costs.map(m => (
                      <TableRow key={m.model}>
                        <TableCell sx={{ py: 0.5, fontFamily: 'monospace', fontSize: 13 }}>{m.model}</TableCell>
                        <TableCell sx={{ py: 0.5 }} align="right">{m.per_request ? '-' : m.input}</TableCell>
                        <TableCell sx={{ py: 0.5 }} align="right">{m.per_request ? '-' : m.output}</TableCell>
                        <TableCell sx={{ py: 0.5 }} align="right">{m.per_request ? `${m.per_request} 余额` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">暂无模型倍率配置</Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Upstreams */}
        <Box sx={{ mb: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                上游概览
                {overview && <Chip size="small" label={overview.upstreams.length} color="primary" variant="outlined" />}
              </Typography>
              {pageLoading ? (
                <Typography variant="body2" color="text.secondary">加载中...</Typography>
              ) : overview && overview.upstreams.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5 }}>上游</TableCell>
                      <TableCell sx={{ py: 0.5 }} align="right">密钥</TableCell>
                      <TableCell sx={{ py: 0.5 }}>最低等级</TableCell>
                      <TableCell sx={{ py: 0.5 }} align="right">权重</TableCell>
                      <TableCell sx={{ py: 0.5 }} align="right">请求</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {overview.upstreams.map(u => (
                      <TableRow key={u.id}>
                        <TableCell sx={{ py: 0.5, fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>{u.id}</TableCell>
                        <TableCell sx={{ py: 0.5 }} align="right">{u.active_keys}/{u.total_keys}</TableCell>
                        <TableCell sx={{ py: 0.5 }}>
                          <Chip size="small" label={u.min_key_level != null && u.min_key_level >= 0 ? `Lv.${u.min_key_level}` : '无限制'} variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ py: 0.5 }} align="right">{u.weight}</TableCell>
                        <TableCell sx={{ py: 0.5 }} align="right">{u.requests}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">暂无上游概览数据</Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Query + Keys */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ mr: 1 }}>计费密钥</Typography>
            <TextField size="small" label="密钥查询" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="输入密钥查询余额"
              onKeyDown={e => e.key === 'Enter' && handleQuery()}
              sx={{ flex: '1 1 200px', minWidth: 180 }} />
            <Button variant="outlined" startIcon={<SearchIcon />} onClick={handleQuery} disabled={loading}>查询</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)}>新建</Button>
          </Box>
          <TableContainer sx={{ maxHeight: 480 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>密钥</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>余额</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>已用余额</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>已用词元</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>等级</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography sx={{ color: 'text.secondary', py: 4 }}>输入密钥查询余额，或点击"新建"</Typography>
                    </TableCell>
                  </TableRow>
                ) : keys.map(k => {
                  const usage = k.usage ?? overview?.key_usage?.find(u => u.key === k.key)
                  return (
                  <TableRow key={k.key} hover>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Tooltip title={k.key} placement="top">
                        <Typography sx={{ fontFamily: 'monospace', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {k.key}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{
                        fontWeight: 600,
                        color: (k.balance ?? 0) < 0 && (k.balance ?? 0) !== -1 ? 'error'
                          : (k.balance ?? 0) === -1 ? 'text.secondary' : 'inherit'
                      }}>
                        {(k.balance ?? 0) === -1 ? '无限额度' : formatCredits(k.balance ?? 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{usage ? formatCredits(usage.credits) : '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{usage ? formatNum(usage.tokens) : '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{
                        fontWeight: 600,
                        color: k.level != null && k.level !== -1 ? 'info.main' : 'text.secondary'
                      }}>
                        {k.level != null && k.level !== -1 ? `Lv.${k.level}` : '无限制'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="设置等级">
                        <IconButton size="small" onClick={() => { setLevelDialog(k); setLevelForm(k.level ?? 0) }}>
                          <LevelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={(k.balance ?? 0) === -1 ? '无限额度密钥不支持调整' : '调整余额'}>
                        <span>
                          <IconButton size="small" onClick={() => { setAdjustDialog(k); setAdjustDelta(0) }}
                            disabled={(k.balance ?? 0) === -1}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(k)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>)
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>创建计费密钥</DialogTitle>
        <DialogContent sx={{ pt: '16px !important', '& .field-row': { display: 'grid', gridTemplateColumns: '1fr 56px', gap: 1, mb: 2 } }}>
          <Box className="field-row">
            <TextField label="密钥" value={createForm.key}
              onChange={e => setCreateForm(f => ({ ...f, key: e.target.value }))}
              placeholder="hs-xxxx" />
            <Tooltip title="快速生成密钥">
              <Button variant="outlined" onClick={() => setCreateForm(f => ({ ...f, key: generateKey() }))}
                sx={{ width: 56, height: 56, p: 0, minWidth: 56 }}>
                <GenerateIcon />
              </Button>
            </Tooltip>
          </Box>
          <Box className="field-row">
            <TextField label="初始余额" type="number"
              slotProps={{ htmlInput: { step: 0.001 } }}
              sx={{ '& input[type=number]::-webkit-outer-spin-button,& input[type=number]::-webkit-inner-spin-button': { display: 'none' }, '& input[type=number]': { MozAppearance: 'textfield' } }}
              value={createForm.balance === -1 ? '' : createForm.balance}
              onChange={e => setCreateForm(f => ({ ...f, balance: e.target.value }))}
              disabled={createForm.balance === -1}
              placeholder={createForm.balance === -1 ? '无限额度' : ''} />
            <Tooltip title={createForm.balance === -1 ? '取消无限额度' : '开启无限额度'}>
              <Button
                variant={createForm.balance === -1 ? 'contained' : 'outlined'}
                color={createForm.balance === -1 ? 'success' : 'inherit'}
                onClick={() => setCreateForm(f => ({ ...f, balance: f.balance === -1 ? '' : -1 }))}
                sx={{ width: 56, height: 56, p: 0, minWidth: 56 }}
              >
                ∞
              </Button>
            </Tooltip>
          </Box>
          <Box className="field-row" sx={{ mb: '0 !important' }}>
            <TextField label="密钥等级" type="text" inputMode="numeric" value={createForm.level === -1 ? '' : createForm.level}
              onChange={e => {
                const v = e.target.value
                if (v === '') { setCreateForm(f => ({ ...f, level: '' })); return }
                const n = parseInt(v, 10)
                if (!isNaN(n) && n >= 0 && n <= 10) setCreateForm(f => ({ ...f, level: n }))
              }}
              disabled={createForm.level === -1}
              placeholder={createForm.level === -1 ? '无限制' : ''} />
            <Tooltip title={createForm.level === -1 ? '取消无限制' : '开启无限制'}>
              <Button
                variant={createForm.level === -1 ? 'contained' : 'outlined'}
                color={createForm.level === -1 ? 'success' : 'inherit'}
                onClick={() => setCreateForm(f => ({ ...f, level: f.level === -1 ? '' : -1 }))}
                sx={{ width: 56, height: 56, p: 0, minWidth: 56 }}
              >
                ∞
              </Button>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={!createForm.key || createForm.balance === '' || createForm.level === ''}>创建</Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={!!adjustDialog} onClose={() => setAdjustDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          调整余额 - {adjustDialog?.key && adjustDialog.key.length > 20
            ? adjustDialog.key.slice(0, 10) + '...' + adjustDialog.key.slice(-6)
            : adjustDialog?.key}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            当前余额: <strong>{adjustDialog?.balance?.toLocaleString() ?? 0}</strong>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button size="small" variant={adjustMode === 'add' ? 'contained' : 'outlined'}
              onClick={() => { setAdjustMode('add'); setAdjustDelta(0.001) }}>
              增加
            </Button>
            <Button size="small" variant={adjustMode === 'subtract' ? 'contained' : 'outlined'}
              color="warning"
              onClick={() => { setAdjustMode('subtract'); setAdjustDelta(0.001) }}>
              扣除
            </Button>
          </Box>
          <TextField fullWidth label={adjustMode === 'add' ? '增加额度' : '扣除额度'} type="number"
            slotProps={{ htmlInput: { min: 0, step: '0.001' } }}
            value={adjustDelta} onChange={e => setAdjustDelta(Math.max(0.001, Number(e.target.value) || 0.001))} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            调整后余额: {((adjustDialog?.balance ?? 0) + (adjustMode === 'add' ? adjustDelta : -adjustDelta)).toLocaleString()}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustDialog(null)}>取消</Button>
          <Button variant="contained" color={adjustMode === 'add' ? 'primary' : 'warning'}
            onClick={handleAdjust}
            disabled={adjustDelta <= 0 || ((adjustDialog?.balance ?? 0) + (adjustMode === 'add' ? adjustDelta : -adjustDelta)) < 0}>
            {adjustMode === 'add' ? '确认增加' : '确认扣除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Level Dialog */}
      <Dialog open={!!levelDialog} onClose={() => setLevelDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>设置密钥等级</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: 'monospace', fontSize: 13 }}>
            {levelDialog?.key}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField fullWidth label="等级" type="text" inputMode="numeric" value={levelForm === -1 ? '' : levelForm}
              sx={{ flex: 1 }}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (e.target.value === '') { setLevelForm(-1); return }
                if (!isNaN(v) && v >= 0 && v <= 10) setLevelForm(v)
              }}
              disabled={levelForm === -1}
              placeholder={levelForm === -1 ? '无限制' : ''} />
            <Tooltip title={levelForm === -1 ? '取消无限制' : '开启无限制'}>
              <Button
                variant={levelForm === -1 ? 'contained' : 'outlined'}
                color={levelForm === -1 ? 'success' : 'inherit'}
                onClick={() => setLevelForm(levelForm === -1 ? 0 : -1)}
                sx={{ width: 56, height: 56, p: 0, minWidth: 56 }}
              >
                ∞
              </Button>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLevelDialog(null)}>取消</Button>
          <Button variant="contained" onClick={handleSetLevel}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除计费密钥 <strong>{deleteConfirm?.key}</strong> 吗？</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>此操作不可逆</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>删除</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
