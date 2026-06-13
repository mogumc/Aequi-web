import { useEffect, useState } from 'react'
import {
  Card, CardContent, Typography, Box, Button, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, Tooltip, Alert, Snackbar,
  Select, MenuItem, FormControl, InputLabel, Tab, Tabs,
  Checkbox, Divider,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Refresh as RefreshIcon, VpnKey as KeyIcon, AddCircle as AddKeyIcon,
  RemoveCircle as RemoveKeyIcon, Healing as ReleaseIcon,
  Save as SaveIcon, Search as SearchIcon,
} from '@mui/icons-material'
import { api, Upstream, KeyItem, ModelRoutesResponse } from '../api/client'
import type { ModelCosts as ModelCostsType } from '../api/client'

interface UpstreamForm {
  id: string
  base_url: string
  weight: number
  format: string
  proxy: string
  model_map: string // JSON string for key-value pairs
  min_key_level: number
}

interface CostEntry {
  model: string
  input: number
  output: number
}

const emptyForm: UpstreamForm = { id: '', base_url: '', weight: 1, format: 'openai', proxy: '', model_map: '', min_key_level: 0 }

export default function Upstreams() {
  const [upstreams, setUpstreams] = useState<Upstream[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSlow, setLoadingSlow] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<UpstreamForm>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [snack, setSnack] = useState('')

  // Key management
  const [keyDialog, setKeyDialog] = useState<string | null>(null)
  const [keyTab, setKeyTab] = useState(0)
  const [keys, setKeys] = useState<KeyItem[]>([])
  const [keysTotal, setKeysTotal] = useState(0)
  const [keysLoading, setKeysLoading] = useState(false)
  const [newKeys, setNewKeys] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  // 模型映射相关
  const [routes, setRoutes] = useState<ModelRoutesResponse | null>(null)
  const [selectedUpstream, setSelectedUpstream] = useState('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [checkedModels, setCheckedModels] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modelSearch, setModelSearch] = useState('')

  // 模型倍率相关
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [costsLoading, setCostsLoading] = useState(false)
  const [costDialog, setCostDialog] = useState(false)
  const [costEditing, setCostEditing] = useState<number | null>(null)
  const [costForm, setCostForm] = useState<CostEntry>({ model: '', input: 0, output: 0 })

  const load = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api.getUpstreams()
      setUpstreams(Array.isArray(data) ? data.filter(Boolean) : [])
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
    setLoading(false)
  }

  const loadRoutes = async () => {
    try {
      const r = await api.getModelRoutes()
      setRoutes(r)
    } catch { /* ignore */ }
  }

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

  useEffect(() => { load(); loadRoutes(); loadCosts() }, [])

  useEffect(() => {
    if (!loading) { setLoadingSlow(false); return }
    const t = setTimeout(() => setLoadingSlow(true), 4000)
    return () => clearTimeout(t)
  }, [loading])

  const handleSave = async () => {
    setError('')
    let parsedModelMap: Record<string, string> | undefined
    if (form.model_map.trim()) {
      try {
        parsedModelMap = JSON.parse(form.model_map)
        if (typeof parsedModelMap !== 'object' || Array.isArray(parsedModelMap)) throw new Error()
      } catch {
        setError('模型映射 JSON 格式无效')
        return
      }
    }
    try {
      if (editing) {
        await api.updateUpstream(editing, {
          base_url: form.base_url,
          weight: form.weight,
          format: form.format,
          proxy: form.proxy || undefined,
          model_map: parsedModelMap ?? null,
          min_key_level: form.min_key_level || undefined,
        } as any)
        setSnack('上游已更新')
      } else {
        await api.createUpstream({
          id: form.id,
          base_url: form.base_url,
          weight: form.weight,
          format: form.format,
          proxy: form.proxy || undefined,
          model_map: parsedModelMap,
          min_key_level: form.min_key_level || undefined,
        })
        setSnack('上游已创建')
      }
      setDialog(false)
      setForm(emptyForm)
      setEditing(null)
      load()
      loadRoutes()
    } catch (e: any) {
      setError(e?.message ?? '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    setError('')
    try {
      await api.deleteUpstream(id, true)
      setSnack('上游已删除')
      setDeleteConfirm(null)
      load()
      loadRoutes()
    } catch (e: any) {
      setError(e?.message ?? '操作失败')
    }
  }

  const openEdit = (u: Upstream) => {
    setForm({
      id: u.id, base_url: u.base_url, weight: u.weight, format: u.format, proxy: u.proxy ?? '',
      model_map: u.model_map ? JSON.stringify(u.model_map, null, 2) : '',
      min_key_level: u.min_key_level ?? 0,
    })
    setEditing(u.id)
    setDialog(true)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setEditing(null)
    setDialog(true)
  }

  // --- Key management ---
  const loadKeys = async (upstreamId: string) => {
    setError('')
    setKeysLoading(true)
    try {
      const res = await api.getKeys(upstreamId, 0, 200)
      setKeys(Array.isArray(res?.keys) ? res.keys : [])
      setKeysTotal(res?.total ?? 0)
    } catch (e: any) {
      setError(e?.message ?? '加载密钥失败')
    }
    setKeysLoading(false)
  }

  const openKeyDialog = (upstreamId: string) => {
    setKeyDialog(upstreamId)
    setKeyTab(0)
    setSelectedKeys(new Set())
    setNewKeys('')
    loadKeys(upstreamId)
  }

  const handleAddKeys = async () => {
    if (!keyDialog || !newKeys.trim()) return
    setError('')
    try {
      const res = await api.addKeys(keyDialog, newKeys.trim())
      setSnack(`已添加 ${res?.added ?? 0} 个密钥`)
      setNewKeys('')
      setKeyTab(0)
      loadKeys(keyDialog)
    } catch (e: any) {
      setError(e?.message ?? '添加密钥失败')
    }
  }

  const handleDeleteKeys = async () => {
    if (!keyDialog || selectedKeys.size === 0) return
    setError('')
    try {
      await api.deleteKeys(keyDialog, Array.from(selectedKeys))
      setSnack(`已删除 ${selectedKeys.size} 个密钥`)
      setSelectedKeys(new Set())
      loadKeys(keyDialog)
    } catch (e: any) {
      setError(e?.message ?? '删除密钥失败')
    }
  }

  const handleReleaseAll = async () => {
    if (!keyDialog) return
    setError('')
    try {
      await api.releaseKeys(keyDialog)
      setSnack('已释放所有冷却中的密钥')
      loadKeys(keyDialog)
    } catch (e: any) {
      setError(e?.message ?? '释放密钥失败')
    }
  }

  const toggleKeySelect = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // --- 模型映射 ---
  const refreshModels = async () => {
    setError('')
    if (!selectedUpstream) {
      setError('请先选择上游')
      return
    }
    setRefreshing(true)
    try {
      const res = await api.refreshModels(selectedUpstream)
      const models = res?.models || []
      setAvailableModels(models)
      const currentRouted = routes?.upstreams?.[selectedUpstream] || []
      setCheckedModels(models.filter(m => currentRouted.includes(m)))
      setSnack(`刷新成功，发现 ${models.length} 个模型`)
    } catch (e: any) {
      setError(e?.message ?? '刷新模型失败')
    }
    setRefreshing(false)
  }

  const applyToRoutes = () => {
    if (!selectedUpstream) return
    const newUpstreams = { ...(routes?.upstreams || {}) }
    newUpstreams[selectedUpstream] = checkedModels
    setRoutes(prev => {
      if (!prev) return prev
      const newModels: Record<string, string[]> = {}
      for (const [upId, modelList] of Object.entries(newUpstreams)) {
        for (const model of modelList) {
          if (!newModels[model]) newModels[model] = []
          newModels[model].push(upId)
        }
      }
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

  const saveRoutes = async () => {
    if (!routes?.upstreams) return
    setError('')
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

  const selectAll = () => setCheckedModels([...availableModels])
  const selectNone = () => setCheckedModels([])

  const toggleModel = (model: string) => {
    setCheckedModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    )
  }

  const handleUpstreamChange = (upstreamId: string) => {
    setSelectedUpstream(upstreamId)
    setAvailableModels([])
    setCheckedModels([])
  }

  // --- 模型倍率 ---
  const openAddCost = () => { setCostEditing(null); setCostForm({ model: '', input: 0, output: 0 }); setCostDialog(true) }
  const openEditCost = (i: number) => { setCostEditing(i); setCostForm({ ...costs[i] }); setCostDialog(true) }

  const handleSaveCost = async () => {
    setError('')
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
    setError('')
    const newCosts = costs.filter((_, idx) => idx !== i)
    const payload: ModelCostsType = {}
    for (const entry of newCosts) payload[entry.model] = { input: entry.input, output: entry.output }
    try {
      await api.setModelCosts(payload)
      setSnack('已删除')
      loadCosts()
    } catch (e: any) { setError(e?.message ?? '删除失败') }
  }

  // 路由表数据
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
      {loadingSlow && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<RefreshIcon />}>
          加载中，如果长时间无响应，请检查后端服务是否正常运行
        </Alert>
      )}

      {/* 上游列表 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">上游列表</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<RefreshIcon />} onClick={() => { load(); loadRoutes(); loadCosts() }} disabled={loading}>刷新</Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>新增上游</Button>
            </Box>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Base URL</TableCell>
                  <TableCell>格式</TableCell>
                  <TableCell>权重</TableCell>
                  <TableCell>密钥</TableCell>
                  <TableCell>请求</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {upstreams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography sx={{ color: 'text.secondary', py: 4 }}>暂无上游，点击"新增上游"添加</Typography>
                    </TableCell>
                  </TableRow>
                ) : upstreams.map(u => (
                  <TableRow key={u.id} hover>
                    <TableCell><Typography sx={{ fontWeight: 600 }}>{u.id}</Typography></TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Tooltip title={u.base_url} placement="top">
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.base_url}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell><Chip size="small" label={u.format} /></TableCell>
                    <TableCell>{u.weight}</TableCell>
                    <TableCell>
                      <Chip size="small" label={`${u.keys_active ?? 0}/${u.keys_total ?? 0}`} variant="outlined" />
                    </TableCell>
                    <TableCell>{(u.selected_total ?? 0).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="密钥管理">
                        <IconButton size="small" color="primary" onClick={() => openKeyDialog(u.id)}>
                          <KeyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="编辑">
                        <IconButton size="small" onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(u.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* 模型映射 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">模型映射</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<RefreshIcon />} onClick={loadRoutes} disabled={loading}>刷新</Button>
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

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>选择上游</InputLabel>
              <Select
                value={selectedUpstream}
                label="选择上游"
                onChange={(e) => handleUpstreamChange(e.target.value)}
              >
                <MenuItem value="">全部上游</MenuItem>
                {upstreams.map(u => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.id}
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

          {availableModels.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" sx={{ mr: 1 }}>
                  可用模型 ({checkedModels.length}/{availableModels.length})
                </Typography>
                <TextField
                  size="small" placeholder="搜索模型…"
                  value={modelSearch} onChange={e => setModelSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.secondary', fontSize: 20 }} />,
                      sx: { fontSize: 13 },
                    },
                  }}
                  sx={{ minWidth: 180, maxWidth: 300 }}
                />
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
                border: 1, borderColor: 'divider', borderRadius: 1, p: 1,
                maxHeight: 300, overflow: 'auto',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0.5,
              }}>
                {availableModels
                  .filter(m => !modelSearch.trim() || m.toLowerCase().includes(modelSearch.trim().toLowerCase()))
                  .map(model => (
                  <Box
                    key={model}
                    sx={{
                      display: 'flex', alignItems: 'center', px: 1, py: 0.25, borderRadius: 0.5,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Checkbox size="small" checked={checkedModels.includes(model)} onChange={() => toggleModel(model)} />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 13 }}>{model}</Typography>
                  </Box>
                ))}
                {modelSearch.trim() && availableModels.filter(m => m.toLowerCase().includes(modelSearch.trim().toLowerCase())).length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, gridColumn: '1 / -1', textAlign: 'center' }}>
                    无匹配模型
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

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
      <Card sx={{ mb: 3 }}>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '编辑上游' : '新增上游'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="ID" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
            disabled={!!editing} sx={{ mb: 2 }} helperText="唯一标识符，如 openai, anthropic" />
          <TextField fullWidth label="Base URL" value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))}
            placeholder="https://api.openai.com" sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField label="权重" type="number" value={form.weight} sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))} />
            <FormControl sx={{ flex: 1 }}>
              <InputLabel>格式</InputLabel>
              <Select value={form.format} label="格式" onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
                <MenuItem value="openai">OpenAI</MenuItem>
                <MenuItem value="anthropic">Anthropic</MenuItem>
                <MenuItem value="gemini">Gemini</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField fullWidth label="代理 (可选)" value={form.proxy} onChange={e => setForm(f => ({ ...f, proxy: e.target.value }))}
            placeholder="socks5://127.0.0.1:1080" sx={{ mb: 2 }} />
          <TextField fullWidth label="最低密钥等级 (可选)" type="number" value={form.min_key_level}
            onChange={e => setForm(f => ({ ...f, min_key_level: Number(e.target.value) }))}
            helperText="设置为 0 表示不限制" sx={{ mb: 2 }} />
          <TextField fullWidth label="模型重定向 (可选)" value={form.model_map}
            onChange={e => setForm(f => ({ ...f, model_map: e.target.value }))}
            placeholder='{"gpt-4o": "deepseek-chat"}'
            helperText="JSON 格式，将请求中的模型名映射到目标模型" multiline minRows={2} maxRows={6}
            sx={{ fontFamily: 'monospace' }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={!form.id || !form.base_url}>{editing ? '保存' : '创建'}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除上游 <strong>{deleteConfirm}</strong> 及其所有密钥吗？</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>此操作不可逆</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>删除</Button>
        </DialogActions>
      </Dialog>

      {/* Key Management Dialog */}
      <Dialog open={!!keyDialog} onClose={() => setKeyDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon /> 密钥管理 - {keyDialog}
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Tabs value={keyTab} onChange={(_, v) => setKeyTab(v)} sx={{ mb: 2 }}>
            <Tab label={`密钥列表 (${keysTotal})`} />
            <Tab label="添加密钥" />
          </Tabs>

          {keyTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button size="small" startIcon={<RefreshIcon />} onClick={() => keyDialog && loadKeys(keyDialog)} disabled={keysLoading}>
                  刷新
                </Button>
                {selectedKeys.size > 0 && (
                  <Button size="small" color="error" startIcon={<RemoveKeyIcon />} onClick={handleDeleteKeys}>
                    删除选中 ({selectedKeys.size})
                  </Button>
                )}
                <Button size="small" startIcon={<ReleaseIcon />} onClick={handleReleaseAll}>
                  释放所有冷却
                </Button>
              </Box>
              {keysLoading ? (
                <Typography color="text.secondary">加载中...</Typography>
              ) : keys.length === 0 ? (
                <Typography color="text.secondary">暂无密钥</Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <input type="checkbox" checked={selectedKeys.size === keys.length && keys.length > 0}
                            onChange={e => {
                              if (e.target.checked) setSelectedKeys(new Set(keys.map(k => k.key)))
                              else setSelectedKeys(new Set())
                            }} />
                        </TableCell>
                        <TableCell>密钥</TableCell>
                        <TableCell>状态</TableCell>
                        <TableCell>活跃请求</TableCell>
                        <TableCell>失败次数</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {keys.map(k => (
                        <TableRow key={k.key} hover selected={selectedKeys.has(k.key)}
                          onClick={() => toggleKeySelect(k.key)} sx={{ cursor: 'pointer' }}>
                          <TableCell padding="checkbox">
                            <input type="checkbox" checked={selectedKeys.has(k.key)}
                              onChange={() => toggleKeySelect(k.key)}
                              onClick={e => e.stopPropagation()} />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>{k.key}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={k.status ?? 'unknown'}
                              color={k.status === 'active' ? 'success' : k.status === 'cooldown' ? 'warning' : 'default'}
                              variant="outlined" />
                          </TableCell>
                          <TableCell>{k.active_requests ?? 0}</TableCell>
                          <TableCell>{k.failure_count ?? 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {keyTab === 1 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                每行一个密钥，支持批量添加
              </Typography>
              <TextField fullWidth multiline minRows={4} maxRows={10} label="密钥列表"
                value={newKeys} onChange={e => setNewKeys(e.target.value)}
                placeholder="sk-xxx-1&#10;sk-xxx-2&#10;sk-xxx-3"
                sx={{ fontFamily: 'monospace' }} />
              <Button variant="contained" startIcon={<AddKeyIcon />} onClick={handleAddKeys}
                disabled={!newKeys.trim()} sx={{ mt: 2 }}>
                添加密钥
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKeyDialog(null)}>关闭</Button>
        </DialogActions>
      </Dialog>

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
