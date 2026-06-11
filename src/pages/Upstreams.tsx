import { useEffect, useState } from 'react'
import {
  Card, CardContent, Typography, Box, Button, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, Tooltip, Alert, Snackbar,
  Select, MenuItem, FormControl, InputLabel, Tab, Tabs,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Refresh as RefreshIcon, VpnKey as KeyIcon, AddCircle as AddKeyIcon,
  RemoveCircle as RemoveKeyIcon, Healing as ReleaseIcon,
} from '@mui/icons-material'
import { api, Upstream, KeyItem } from '../api/client'

interface UpstreamForm {
  id: string
  base_url: string
  weight: number
  format: string
  proxy: string
}

const emptyForm: UpstreamForm = { id: '', base_url: '', weight: 1, format: 'openai', proxy: '' }

export default function Upstreams() {
  const [upstreams, setUpstreams] = useState<Upstream[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<UpstreamForm>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [snack, setSnack] = useState('')

  // Key management
  const [keyDialog, setKeyDialog] = useState<string | null>(null) // upstream id
  const [keyTab, setKeyTab] = useState(0) // 0=list, 1=add
  const [keys, setKeys] = useState<KeyItem[]>([])
  const [keysTotal, setKeysTotal] = useState(0)
  const [keysLoading, setKeysLoading] = useState(false)
  const [newKeys, setNewKeys] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getUpstreams()
      setUpstreams(Array.isArray(data) ? data.filter(Boolean) : [])
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    try {
      if (editing) {
        await api.updateUpstream(editing, {
          base_url: form.base_url,
          weight: form.weight,
          format: form.format,
          proxy: form.proxy || undefined,
        } as any)
        setSnack('上游已更新')
      } else {
        await api.createUpstream({
          id: form.id,
          base_url: form.base_url,
          weight: form.weight,
          format: form.format,
          proxy: form.proxy || undefined,
        })
        setSnack('上游已创建')
      }
      setDialog(false)
      setForm(emptyForm)
      setEditing(null)
      load()
    } catch (e: any) {
      setError(e?.message ?? '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteUpstream(id, true)
      setSnack('上游已删除')
      setDeleteConfirm(null)
      load()
    } catch (e: any) {
      setError(e?.message ?? '操作失败')
    }
  }

  const openEdit = (u: Upstream) => {
    setForm({ id: u.id, base_url: u.base_url, weight: u.weight, format: u.format, proxy: u.proxy ?? '' })
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

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">上游列表</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>刷新</Button>
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
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{u.base_url}</Typography>
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
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField fullWidth label="代理 (可选)" value={form.proxy} onChange={e => setForm(f => ({ ...f, proxy: e.target.value }))}
            placeholder="socks5://127.0.0.1:1080" />
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

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
