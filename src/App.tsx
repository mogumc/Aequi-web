import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItemButton, ListItemIcon,
  ListItemText, Box, IconButton, Tooltip, Dialog, TextField, DialogTitle,
  DialogContent, DialogActions, Button, Chip, useMediaQuery, useTheme,
} from '@mui/material'
import {
  Dashboard as DashboardIcon, Dns as UpstreamIcon, Key as KeyIcon,
  Psychology as ModelIcon, AccountBalance as BillingIcon,
  Settings as ConfigIcon, Menu as MenuIcon, VpnKey as TokenIcon,
  History as RequestsIcon,
  LightMode, DarkMode, SettingsBrightness,
} from '@mui/icons-material'
import { useThemeMode } from './contexts/ThemeModeContext'
import { setAdminToken, getAdminToken } from './api/client'
import Dashboard from './pages/Dashboard'
import Upstreams from './pages/Upstreams'
import Models from './pages/Models'
import Billing from './pages/Billing'
import Config from './pages/Config'
import Requests from './pages/Requests'
import NotFound from './pages/NotFound'

const DRAWER_WIDTH = 240

const NAV_ITEMS = [
  { path: '/dashboard', label: '仪表盘', icon: <DashboardIcon /> },
  { path: '/requests', label: '请求历史', icon: <RequestsIcon /> },
  { path: '/upstreams', label: '上游管理', icon: <UpstreamIcon /> },
  { path: '/models', label: '模型路由', icon: <ModelIcon /> },
  { path: '/billing', label: '计费密钥', icon: <BillingIcon /> },
  { path: '/config', label: '系统配置', icon: <ConfigIcon /> },
]

const THEME_MODE_LABELS: Record<string, string> = {
  system: '跟随系统',
  light: '亮色模式',
  dark: '暗色模式',
}

const THEME_MODE_ICONS: Record<string, React.ReactNode> = {
  system: <SettingsBrightness />,
  light: <LightMode />,
  dark: <DarkMode />,
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const muiTheme = useTheme()
  const { mode: themeMode, cycleMode } = useThemeMode()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tokenDialog, setTokenDialog] = useState(false)
  const [tokenInput, setTokenInput] = useState(getAdminToken())

  // 未配置 token 时自动弹出配置窗口
  useEffect(() => {
    if (!getAdminToken()) {
      setTokenDialog(true)
    }
  }, [])

  const currentNav = NAV_ITEMS.find(n => location.pathname.startsWith(n.path)) || NAV_ITEMS[0]

  const handleSaveToken = () => {
    setAdminToken(tokenInput)
    setTokenDialog(false)
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }} color="primary">
          GPTLoad RS
        </Typography>
        <Typography variant="caption" color="text.secondary">
          负载均衡管理面板
        </Typography>
      </Box>
      <List sx={{ flex: 1, px: 1 }}>
        {NAV_ITEMS.map(item => (
          <ListItemButton
            key={item.path}
            selected={location.pathname.startsWith(item.path)}
            onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false) }}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={`主题：${THEME_MODE_LABELS[themeMode]}（点击切换）`}>
          <IconButton size="small" onClick={cycleMode} sx={{ color: 'text.secondary' }}>
            {THEME_MODE_ICONS[themeMode]}
          </IconButton>
        </Tooltip>
        <Chip
          icon={<TokenIcon />}
          label={getAdminToken() ? '已配置 Token' : '未配置 Token'}
          color={getAdminToken() ? 'success' : 'warning'}
          size="small"
          onClick={() => setTokenDialog(true)}
          sx={{ cursor: 'pointer' }}
        />
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {currentNav.label}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      {isMobile ? (
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)}>
          {drawer}
        </Drawer>
      ) : (
        <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', position: 'sticky', top: '64px', height: 'calc(100vh - 64px)', borderRight: '1px solid', borderColor: 'divider' } }}>
          {drawer}
        </Drawer>
      )}

      {/* Main content */}
      <Box component="main" sx={{ flex: 1, mt: '64px', p: 3, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upstreams" element={<Upstreams />} />
          <Route path="/models" element={<Models />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/config" element={<Config />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Box>

      {/* Token Dialog */}
      <Dialog open={tokenDialog} onClose={() => setTokenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配置管理 Token</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth margin="dense" label="X-Admin-Token"
            value={tokenInput} onChange={e => setTokenInput(e.target.value)}
            placeholder="输入管理员 Token"
            helperText="所有管理 API 需要此 Token 进行认证"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTokenDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveToken}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
