# Aequi Web

Aequi 代理网关的管理面板（React 19 + TypeScript + Vite + Tailwind v4 + Radix）。

## 开发

```bash
npm install
npm run dev     # http://localhost:5173/web/
```

开发服务器把 `/api`、`/health`、`/v1` 代理到 `127.0.0.1:8080`，
同源访问省去 CORS 配置；后端单独在 8080 上启动即可。

## 构建

```bash
npm run build   # 产物在 dist/
```

面板挂在后端的 `/web` 下，因此 `vite.config.ts` 的 `base` 固定为 `/web/`，
路由 basename 取自 `import.meta.env.BASE_URL`，两者跟着同一个值走。
换挂载点时用 `VITE_BASE` 覆盖。

产物如何进入后端，见 `.workbuddy/` 下的说明。

## 接口

接口契约见后端仓库根目录的 `API.md`（`github.com/mogumc/aequi`）。

- 认证令牌与账号信息存 localStorage。
- 后端地址默认同源；分离部署时用 `VITE_API_BASE_URL` 指定。

## 脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器（含接口代理） |
| `npm run build` | 构建到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run typecheck` | 类型检查 |
| `npm run lint` | 类型检查 + ESLint |

## 目录结构

```
src/
├── index.tsx            # 入口：路由 basename、错误边界
├── app.tsx              # 路由表
├── index.css            # 全局样式 + 主题变量
├── components/          # 通用组件（layout、ui/ 为 shadcn 组件）
├── pages/               # 页面模块，一页一目录
├── lib/                 # api 客户端、格式化、剪贴板等工具
├── hooks/
└── data/                # 接口数据结构类型
```
