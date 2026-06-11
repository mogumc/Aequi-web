import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { createAppTheme } from '../theme'

export type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedMode = 'light' | 'dark'

interface ThemeModeContextType {
  mode: ThemeMode
  resolvedMode: ResolvedMode
  cycleMode: () => void
}

const STORAGE_KEY = 'gptload_theme_mode'

function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch { /* localStorage 不可用时忽略 */ }
  return 'system'
}

function getSystemPreference(): ResolvedMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const ThemeModeContext = createContext<ThemeModeContextType>({
  mode: 'system',
  resolvedMode: 'light',
  cycleMode: () => {},
})

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode)
  const [systemPref, setSystemPref] = useState<ResolvedMode>(getSystemPreference)

  // 监听系统主题变化
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemPref(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedMode: ResolvedMode = mode === 'system' ? systemPref : mode

  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode])

  const cycleMode = useCallback(() => {
    setMode(prev => {
      const order: ThemeMode[] = ['system', 'light', 'dark']
      const idx = order.indexOf(prev)
      const next = order[(idx + 1) % order.length]
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch { /* localStorage 不可用时忽略 */ }
      return next
    })
  }, [])

  return (
    <ThemeModeContext.Provider value={{ mode, resolvedMode, cycleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode() {
  return useContext(ThemeModeContext)
}
