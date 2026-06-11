import { Box, Typography, Button, Card, CardContent } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Home as HomeIcon } from '@mui/icons-material'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card sx={{ maxWidth: 420, textAlign: 'center' }}>
        <CardContent sx={{ p: 5 }}>
          <Typography variant="h1" sx={{ fontWeight: 800, fontSize: 72, color: 'primary.main', lineHeight: 1 }}>
            404
          </Typography>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            页面未找到
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            请检查地址是否正确，或返回首页
          </Typography>
          <Button variant="contained" startIcon={<HomeIcon />} onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}
