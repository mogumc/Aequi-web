import { useEffect, useState } from 'react'
import {
  Card, CardContent, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Alert,
  Snackbar, Chip, Select, MenuItem, FormControl,
  InputLabel, Checkbox, Divider, IconButton, Tooltip,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import {
  Refresh as RefreshIcon, Save as SaveIcon, Add as AddIcon,
  Delete as DeleteIcon, Edit as EditIcon,
} from '@mui/icons-material'
import { api, ModelRoutesResponse, Upstream } from '../api/client'
import type { ModelCosts as ModelCostsType } from '../api/client'

interface CostEntry {
  model: string
  input: number
  output: number
}

export default function Models() {
  const [routes, setRoutes] = useState<ModelRoutesResponse | null>(null)
  const [upstreams, setUpstreams] = useState<Upstream[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [snack, setSnack] = useState('')

  // 模型映射相关状态
  const [selectedUpstream, setSelectedUpstream] = useState('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [checkedModels, setCheckedModels] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [r, u] = await Promise.all([api.getModelRoutes(), api.getUpstreams()])
      setRoutes(r)
      setUpstreams(Array.isArray(u) ? u : [])
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
    setLoading(false)
  }

  useEffect(() => { load(); loadCosts() }, [])

  // 从上游刷新模型列表
  const refreshModels = async () => {
    if (!selectedUpstream) {
      setError('请先选择上游')
      return
    }
    setRefreshing(true)
    try {
      const res = await api.refreshModels(selectedUpstream)
      const models = res?.models || []
      setAvailableModels(models)
      // 默认全部选中当前上游已路由的模型
      const currentRouted = routes?.upstreams?.[selectedUpstream] || []
      setCheckedModels(models.filter(m => currentRouted.includes(m)))
      setSnack(`刷新成功，发现 ${models.length} 个模型`)
    } catch (e: any) {
      setError(e?.message ?? '刷新模型失败')
    }
    setRefreshing(false)
  }

  // 应用选中的模型到路由配置（本地状态）
  const applyToRoutes = () => {
    if (!selectedUpstream) return
    const newUpstreams = { ...(routes?.upstreams || {}) }
    newUpstreams[selectedUpstream] = checkedModels
    setRoutes(prev => {
      if (!prev) return prev
      // 从 upstreams 反向构建 models
      const newModels: Record<string, string[]> = {}
      for (const [upId, modelList] of Object.entries(newUpstreams)) {
        for (const model of modelList) {
          if (!newModels[model]) newModels[model] = []
          newModels[model].push(upId)
        }
      }
      // 去重排序
      for (const k of Object.keys(newModels)) {
        newModels[k] = Array.from(new Set(newModels[k])).sort()
      }
      return {
        ...prev,
        updated_at_ms: Date.now(),
        models: newModels,
        upstreams: newUpstreams,
      }
    })
    setSnack('已应用到路由配置，点击保存生效')
  }

  // 保存路由配置到后端
  const saveRoutes = async () => {
    if (!routes?.upstreams) return
    setSaving(true)
    try {
      const res = await api.updateModelRoutes({ upstreams: routes.upstreams })
      setRoutes(res)
      setSnack('路由保存成功')
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
    }
    setSaving(false)
  }

  // 全选/全不选
  const selectAll = () => setCheckedModels([...availableModels])
  const selectNone = () => setCheckedModels([])

  // 切换模型选中状态
  const toggleModel = (model: string) => {
    setCheckedModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    )
  }

  // 模型倍率
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [costsLoading, setCostsLoading] = useState(false)
  const [costDialog, setCostDialog] = useState(false)
  const [costEditing, setCostEditing] = useState<number | null>(null)
  const [costForm, setCostForm] = useState<CostEntry>({ model: '', input: 0, output: 0 })

  const loadCosts = async () => {
    setCostsLoading(true)
    try {
      const data = await api.getModelCosts()
      const entries: CostEntry[] = []
      if (data && typeof data === 'object') {
        for (const [model, c] of Object.entries(data)) {
          if (c && typeof c === 'object') entries.push({ model, input: c.input ?? 0, output: c.output ?? 0 })
        }
      }
      setCosts(entries)
    } catch { /* ignore */ }
    setCostsLoading(false)
  }

  const openAddCost = () => { setCostEditing(null); setCostForm({ model: '', input: 0, output: 0 }); setCostDialog(true) }
  const openEditCost = (i: number) => { setCostEditing(i); setCostForm({ ...costs[i] }); setCostDialog(true) }

  const handleSaveCost = async () => {
    if (!costForm.model.trim()) { setError('请输入模型名称'); return }
    const newCosts = costEditing !== null ? costs.map((c, i) => i === costEditing ? { ...costForm } : c) : [...costs, { ...costForm }]
    const payload: ModelCostsType = {}
    for (const entry of newCosts) payload[entry.model] = { input: entry.input, output: entry.output }
    try {
      await api.setModelCosts(payload)
      setSnack('模型倍率已保存')
      setCostDialog(false)
      loadCosts()
    } catch (e: any) { setError(e?.message ?? '保存失败') }
  }

  const handleDeleteCost = async (i: number) => {
    const newCosts = costs.filter((_, idx) => idx !== i)
    const payload: ModelCostsType = {}
    for (const entry of newCosts) payload[entry.model] = { input: entry.input, output: entry.output }
    try {
      await api.setModelCosts(payload)
      setSnack('已删除')
      loadCosts()
    } catch (e: any) { setError(e?.message ?? '删除失败') }
  }

  // 切换上游时重置模型列表
  const handleUpstreamChange = (upstreamId: string) => {
    setSelectedUpstream(upstreamId)
    setAvailableModels([])
    setCheckedModels([])
  }

  // 路由表数据（现有映射），按选择的上游筛选
  const modelRows: { model: string; upstreams: string[] }[] = []
  if (routes?.models) {
    for (const [model, ups] of Object.entries(routes.models)) {
      if (!selectedUpstream || ups.includes(selectedUpstream)) {
        modelRows.push({ model, upstreams: Array.isArray(ups) ? ups : [] })
      }
    }
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* 模型映射面板 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">模型映射</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>刷新</Button>
              <Button
                startIcon={<SaveIcon />}
                onClick={saveRoutes}
                disabled={saving || !routes?.upstreams}
                variant="contained"
                color="primary"
              >
                保存路由
              </Button>
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            选择上游，刷新模型列表，勾选要映射的模型，应用后保存生效
          </Typography>

          {/* 上游选择 */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>选择上游</InputLabel>
              <Select
                value={selectedUpstream}
                label="选择上游"
                onChange={(e) => handleUpstreamChange(e.target.value)}
              >
                {upstreams.map(u => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.id} (keys={u.keys_total})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              startIcon={<RefreshIcon />}
              onClick={refreshModels}
              disabled={!selectedUpstream || refreshing}
            >
              {refreshing ? '刷新中...' : '刷新模型列表'}
            </Button>
          </Box>

          {/* 模型列表 */}
          {availableModels.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                <Typography variant="subtitle2">
                  可用模型 ({checkedModels.length}/{availableModels.length})
                </Typography>
                <Button size="small" onClick={checkedModels.length === availableModels.length ? selectNone : selectAll}>
                  {checkedModels.length === availableModels.length ? '全不选' : '全选'}
                </Button>
                <Button size="small" onClick={() => { setAvailableModels([]); setCheckedModels([]) }}>
                  关闭
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={applyToRoutes}
                  sx={{ ml: 'auto' }}
                >
                  应用到路由
                </Button>
              </Box>
              <Box sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
                maxHeight: 300,
                overflow: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 0.5,
              }}>
                {availableModels.map(model => (
                  <Box
                    key={model}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      px: 1,
                      py: 0.25,
                      borderRadius: 0.5,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={checkedModels.includes(model)}
                      onChange={() => toggleModel(model)}
                    />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {model}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* 现有路由映射表 */}
          <Typography variant="subtitle1" sx={{ mb: 1 }}>当前路由映射</Typography>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>模型名称</TableCell>
                  <TableCell>目标上游</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modelRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} align="center">
                      <Typography sx={{ color: 'text.secondary', py: 4 }}>暂无模型路由</Typography>
                    </TableCell>
                  </TableRow>
                ) : modelRows.map((r) => (
                  <TableRow key={r.model} hover>
                    <TableCell>
                      <Chip size="small" label={r.model} sx={{ fontFamily: 'monospace' }} />
                    </TableCell>
                    <TableCell>
                      {r.upstreams.map(u => (
                        <Chip key={u} size="small" label={u} sx={{ mr: 0.5 }} />
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {routes?.updated_at_ms && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              更新于: {new Date(routes.updated_at_ms).toLocaleString()}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* 模型倍率 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">模型倍率</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<RefreshIcon />} onClick={loadCosts} disabled={costsLoading}>刷新</Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openAddCost}>新增</Button>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            设置每个模型的输入/输出倍率，用于余额计算
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>模型名称</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>输入倍率</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>输出倍率</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {costs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography sx={{ color: 'text.secondary', py: 4 }}>暂无模型倍率配置</Typography>
                    </TableCell>
                  </TableRow>
                ) : costs.map((c, i) => (
                  <TableRow key={c.model} hover>
                    <TableCell><Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.model}</Typography></TableCell>
                    <TableCell>{c.input}</TableCell>
                    <TableCell>{c.output}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="编辑"><IconButton size="small" onClick={() => openEditCost(i)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => handleDeleteCost(i)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* 倍率编辑弹窗 */}
      <Dialog open={costDialog} onClose={() => setCostDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{costEditing !== null ? '编辑倍率' : '新增倍率'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="模型名称" value={costForm.model}
            onChange={e => setCostForm(f => ({ ...f, model: e.target.value }))}
            placeholder="gpt-4o" sx={{ mb: 2 }} disabled={costEditing !== null} helperText="唯一标识" />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField fullWidth label="输入倍率" type="number" value={costForm.input}
              slotProps={{ htmlInput: { min: 0, step: '0.1' } }}
              onChange={e => setCostForm(f => ({ ...f, input: Number(e.target.value) || 0 }))} />
            <TextField fullWidth label="输出倍率" type="number" value={costForm.output}
              slotProps={{ htmlInput: { min: 0, step: '0.1' } }}
              onChange={e => setCostForm(f => ({ ...f, output: Number(e.target.value) || 0 }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCostDialog(false)}>取消</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveCost} disabled={!costForm.model.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
