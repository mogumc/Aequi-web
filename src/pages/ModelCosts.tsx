import { useEffect, useState } from 'react'
import {
  Card, CardContent, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Alert, Snackbar,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Tooltip,
} from '@mui/material'
import {
  Refresh as RefreshIcon, Add as AddIcon, Delete as DeleteIcon,
  Edit as EditIcon, Save as SaveIcon,
} from '@mui/icons-material'
import { api } from '../api/client'
import type { ModelCosts } from '../api/client'

interface CostEntry {
  model: string
  input: number
  output: number
}

export default function ModelCosts() {
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [snack, setSnack] = useState('')
  const [editDialog, setEditDialog] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CostEntry>({ model: '', input: 0, output: 0 })

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getModelCosts()
      const entries: CostEntry[] = []
      if (data && typeof data === 'object') {
        for (const [model, c] of Object.entries(data)) {
          if (c && typeof c === 'object') {
            entries.push({ model, input: c.input ?? 0, output: c.output ?? 0 })
          }
        }
      }
      setCosts(entries)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditingIndex(null)
    setEditForm({ model: '', input: 0, output: 0 })
    setEditDialog(true)
  }

  const openEdit = (index: number) => {
    setEditingIndex(index)
    setEditForm({ ...costs[index] })
    setEditDialog(true)
  }

  const handleSave = async () => {
    if (!editForm.model.trim()) {
      setError('请输入模型名称')
      return
    }
    let newCosts = [...costs]
    if (editingIndex !== null) {
      newCosts[editingIndex] = { ...editForm }
    } else {
      newCosts.push({ ...editForm })
    }
    const payload: ModelCosts = {}
    for (const entry of newCosts) {
      payload[entry.model] = { input: entry.input, output: entry.output }
    }
    try {
      await api.setModelCosts(payload)
      setSnack('模型倍率已保存')
      setEditDialog(false)
      load()
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
    }
  }

  const handleDelete = async (index: number) => {
    const newCosts = costs.filter((_, i) => i !== index)
    const payload: ModelCosts = {}
    for (const entry of newCosts) {
      payload[entry.model] = { input: entry.input, output: entry.output }
    }
    try {
      await api.setModelCosts(payload)
      setSnack('已删除')
      load()
    } catch (e: any) {
      setError(e?.message ?? '删除失败')
    }
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">模型倍率（积分制度）</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>刷新</Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>新增</Button>
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            设置每个模型的输入/输出倍率，用于积分计算
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>模型名称</TableCell>
                  <TableCell>输入倍率</TableCell>
                  <TableCell>输出倍率</TableCell>
                  <TableCell align="right">操作</TableCell>
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
                    <TableCell>
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.model}</Typography>
                    </TableCell>
                    <TableCell>{c.input}</TableCell>
                    <TableCell>{c.output}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="编辑">
                        <IconButton size="small" onClick={() => openEdit(i)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => handleDelete(i)}>
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

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingIndex !== null ? '编辑倍率' : '新增倍率'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="模型名称" value={editForm.model}
            onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
            placeholder="gpt-4o" sx={{ mb: 2 }}
            disabled={editingIndex !== null} helperText="唯一标识" />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField fullWidth label="输入倍率" type="number" value={editForm.input}
              slotProps={{ htmlInput: { min: 0, step: '0.1' } }}
              onChange={e => setEditForm(f => ({ ...f, input: Number(e.target.value) || 0 }))} />
            <TextField fullWidth label="输出倍率" type="number" value={editForm.output}
              slotProps={{ htmlInput: { min: 0, step: '0.1' } }}
              onChange={e => setEditForm(f => ({ ...f, output: Number(e.target.value) || 0 }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>取消</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}
            disabled={!editForm.model.trim()}>保存</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
