import { useState, useEffect } from 'react'
import {
  Card, CardContent, Typography, Box, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, Snackbar, IconButton, Tooltip, Grid, Chip,
} from '@mui/material'
import { Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Casino as GenerateIcon, Refresh as RefreshIcon, TrendingUp as LevelIcon } from '@mui/icons-material'
import { api, BillingKey, type BillingOverview } from '../api/client'

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
  const [error, setError] = useState('')
  const [createDialog, setCreateDialog] = useState(false)
  const [adjustDialog, setAdjustDialog] = useState<BillingKey | null>(null)
  const [createForm, setCreateForm] = useState({ key: '', balance: 0 })
  const [adjustDelta, setAdjustDelta] = useState(0.001)
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('add')
  const [snack, setSnack] = useState('')
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [levelDialog, setLevelDialog] = useState<BillingKey | null>(null)
  const [levelForm, setLevelForm] = useState(-1)

  useEffect(() => {
    api.listBillingKeys().then(d => {
      setKeys(Array.isArray(d?.keys) ? d.keys : [])
    }).catch(() => {})
    api.getBillingOverview().then(d => {
      if (d && typeof d === 'object' && 'billing' in d) setOverview(d)
    }).catch(() => {})
  }, [])

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
    if (createForm.balance < -1) {
      setError('余额不能小于 -1')
      return
    }
    try {
      const result = await api.createBillingKey(createForm.key, createForm.balance)
      if (result && typeof result === 'object' && result.key) {
        setKeys(prev => [result, ...prev])
      }
      setCreateDialog(false)
      setCreateForm({ key: '', balance: 0 })
      setSnack('计费密钥已创建')
    } catch (e: any) {
      setError(e?.message ?? '操作失败')
    }
  }

  const handleAdjust = async () => {
    if (!adjustDialog) return
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
        setKeys(prev => prev.map(k => k.key === result.key ? result : k))
      }
      setAdjustDialog(null)
      setAdjustDelta(0.001)
      setAdjustMode('add')
      setSnack(adjustMode === 'add' ? '余额已增加' : '余额已扣除')
    } catch (e: any) {
      setError(e?.message ?? '操作失败')
    }
  }

  const handleSetLevel = async () => {
    if (!levelDialog) return
    try {
      const existing = await api.getKeyLevels().catch(() => ({} as Record<string, number>))
      const data: Record<string, number> = existing && typeof existing === 'object' && !('error' in existing)
        ? { ...existing }
        : {}
      if (levelForm === -1) {
        delete data[levelDialog.key]
      } else {
        data[levelDialog.key] = levelForm
      }
      await api.setKeyLevels(data)
      setLevelDialog(null)
      setSnack(levelForm === -1 ? '已设为无限制' : `等级已设为 ${levelForm}`)
    } catch (e: any) {
      setError(e?.message ?? '设置等级失败')
    }
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Overview */}
      {overview && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">费用概览</Typography>
              <Button size="small" startIcon={<RefreshIcon />} onClick={() =>
                api.getBillingOverview().then(d => { if (d && 'billing' in d) setOverview(d) }).catch(() => {})
              }>刷新</Button>
            </Box>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 6, sm: 2 }}>
                <Chip size="small" color="primary" variant="outlined" label={`总密钥 ${overview.billing.total_keys}`} />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <Chip size="small" color="info" variant="outlined" label={`活跃 ${overview.billing.active_keys}`} />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <Chip size="small" color="warning" variant="outlined" label={`无限额度 ${overview.billing.unlimited_keys}`} />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <Chip size="small" color="error" variant="outlined" label={`耗尽 ${overview.billing.exhausted_keys}`} />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <Chip size="small" color="success" variant="outlined" label={`余额 ${overview.billing.total_balance.toLocaleString()}`} />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <Chip size="small" variant="outlined" label={`请求 ${overview.requests_total}/${overview.requests_inflight}`} />
              </Grid>
            </Grid>
            {overview.model_costs.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                模型倍率: {overview.model_costs.map(m => `${m.model}(${m.input}/${m.output})`).join(', ')}
              </Typography>
            )}
            {overview.upstreams.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                上游: {overview.upstreams.map(u => `${u.id}[${u.active_keys}/${u.total_keys}]`).join(', ')}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Query Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>查询余额</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField size="small" label="计费密钥" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="输入计费密钥查询余额"
              onKeyDown={e => e.key === 'Enter' && handleQuery()}
              sx={{ flex: '1 1 200px', minWidth: 200 }} />
            <Button variant="outlined" startIcon={<SearchIcon />} onClick={handleQuery} disabled={loading} sx={{ whiteSpace: 'nowrap' }}>
              查询
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)} sx={{ whiteSpace: 'nowrap' }}>
              新建
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Keys List */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>计费密钥</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>密钥</TableCell>
                  <TableCell>余额</TableCell>
                  <TableCell>等级</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography sx={{ color: 'text.secondary', py: 4 }}>输入密钥查询余额，或点击"新建"</Typography>
                    </TableCell>
                  </TableRow>
                ) : keys.map(k => (
                  <TableRow key={k.key} hover>
                    <TableCell>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: 14 }}>{k.key}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{
                        fontWeight: 600,
                        color: (k.balance ?? 0) < 0 && (k.balance ?? 0) !== -1 ? 'error'
                          : (k.balance ?? 0) === -1 ? 'success' : 'inherit'
                      }}>
                        {(k.balance ?? 0) === -1 ? '无限额度' : (k.balance ?? 0).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={k.level != null ? `Lv.${k.level}` : '无限制'}
                        color={k.level != null ? 'info' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="设置等级">
                        <IconButton size="small" onClick={() => { setLevelDialog(k); setLevelForm(k.level ?? -1) }}>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>创建计费密钥</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField fullWidth label="密钥" value={createForm.key} sx={{ flex: 1 }}
              onChange={e => setCreateForm(f => ({ ...f, key: e.target.value }))}
              placeholder="hs-xxxx" />
            <Tooltip title="快速生成密钥">
              <Button variant="outlined" sx={{ minWidth: 48 }} onClick={() => setCreateForm(f => ({ ...f, key: generateKey() }))}>
                <GenerateIcon />
              </Button>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField fullWidth label="初始余额" type="number"
              slotProps={{ htmlInput: { min: 0, step: '0.001' } }}
              value={createForm.balance === -1 ? '' : createForm.balance}
              onChange={e => setCreateForm(f => ({ ...f, balance: Math.max(0, Number(e.target.value) || 0) }))}
              disabled={createForm.balance === -1}
              placeholder={createForm.balance === -1 ? '无限额度' : ''}
              helperText={createForm.balance === -1 ? '无限额度（-1）' : '点击右侧按钮开启无限额度'}
              error={createForm.balance < -1} />
            <Tooltip title={createForm.balance === -1 ? '取消无限额度' : '开启无限额度'}>
              <Button
                variant={createForm.balance === -1 ? 'contained' : 'outlined'}
                color={createForm.balance === -1 ? 'success' : 'primary'}
                onClick={() => setCreateForm(f => ({ ...f, balance: f.balance === -1 ? 0 : -1 }))}
                sx={{ minWidth: 48, height: 56, mt: '8px' }}
              >
                ∞
              </Button>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={!createForm.key}>创建</Button>
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
      <Dialog open={!!levelDialog} onClose={() => setLevelDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>设置密钥等级</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            密钥: <strong>{levelDialog?.key}</strong>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(l => (
              <Button key={l} size="small"
                variant={levelForm === l ? 'contained' : 'outlined'}
                color={levelForm === l ? 'info' : 'inherit'}
                onClick={() => setLevelForm(l)}
                sx={{ minWidth: 40 }}
              >
                {l}
              </Button>
            ))}
          </Box>
          <Button
            variant={levelForm === -1 ? 'contained' : 'outlined'}
            color={levelForm === -1 ? 'success' : 'inherit'}
            onClick={() => setLevelForm(-1)}
            size="small"
          >
            无限制（-1）
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLevelDialog(null)}>取消</Button>
          <Button variant="contained" onClick={handleSetLevel}>保存</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
