import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 产物固定输出到本项目的 dist/。
 *
 * 不要把它指到别的仓库（例如 ../Aequi/web）：CI 只 checkout 本仓库，
 * 那种路径在 CI 里不存在，构建会直接失败。分发是构建之后的一步复制，
 * 见 .workbuddy/ 里的说明。
 */
export default defineConfig({
  // 面板嵌在后端二进制的 /web 下（rust-embed + `/web/*` 挂载），
  // 资源带 /web/ 前缀，深层路由下也不会解析错位置；换挂载点用 VITE_BASE 覆盖。
  base: process.env.VITE_BASE ?? '/web/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    // 本地开发把接口转给后端，同源访问省去 CORS 配置。
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/health': 'http://127.0.0.1:8080',
      '/v1': 'http://127.0.0.1:8080',
    },
  },
})
