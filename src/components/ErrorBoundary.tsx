import React from 'react'
import { Box, Typography, Button, Card, CardContent } from '@mui/material'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Card sx={{ maxWidth: 500 }}>
            <CardContent>
              <Typography variant="h5" color="error" gutterBottom>页面渲染出错</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {this.state.error?.message ?? '未知错误'}
              </Typography>
              <Button variant="contained" onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.hash = '#/dashboard'
                window.location.reload()
              }}>
                重新加载
              </Button>
            </CardContent>
          </Card>
        </Box>
      )
    }
    return this.props.children
  }
}
