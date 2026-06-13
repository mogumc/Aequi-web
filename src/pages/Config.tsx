import { useEffect, useState } from 'react'
import {
  Card, CardContent, Typography, Box, Button, Alert, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip,
} from '@mui/material'
import {
  Refresh as RefreshIcon, Sync as SyncIcon,
} from '@mui/icons-material'
import { api } from '../api/client'
import type { Config } from '../api/client'

export default function Config() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [snack, setSnack] = useState('')

  const load = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api.getConfig()
      setConfig(data && typeof data === 'object' ? data : null)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleReload = async () => {
    setError('')
    try {
      await api.reload()
      setSnack('索引已重建')
      load()
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  const renderValue = (val: unknown): string => {
    if (val === null || val === undefined) return '-'
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          刷新配置
        </Button>
        <Button variant="contained" color="warning" startIcon={<SyncIcon />} onClick={handleReload}>
          重建索引
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>当前配置</Typography>
          {config ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>配置项</TableCell>
                    <TableCell>值</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(config).map(([key, val]) => (
                    <TableRow key={key} hover>
                      <TableCell>
                        <Chip size="small" label={key} sx={{ fontFamily: 'monospace' }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {renderValue(val)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">
              {loading ? '加载中...' : '无法获取配置，请检查 Token 是否已配置'}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
