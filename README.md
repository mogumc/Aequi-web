# Aequi Web

Aequi 代理网关的管理面板（React 19 + TypeScript + Vite + Tailwind v4 + Radix）。

## 页面与能力

- **仪表盘**：服务状态、今日请求量与错误率、额度预警（排除无限额度密钥）
- **访问密钥**：创建 / 编辑 / 调整额度 / 删除，每把密钥的用量视图（游标分页），模型白名单按「块/模型」双层勾选
- **上游配置**：块与块内密钥管理（列表虚拟滚动、一键测试全部、完整密钥查看），模型编辑器支持一键全选 / 清空与转发 / 倍率设置
- **模型总览**：同名模型按名合并，展开查看各块路由（调用写法、转发名、倍率），单条路由可直接编辑
- **请求日志**：游标分页向前翻阅保留期内日志
- **密钥门户**（`/web/portal`）：密钥自助视图——余额、token 分项（输入 / 输出 / 缓存 / 缓存率）与用量记录，大数从 K 起缩写、悬停看精确值；统计窗口（最近 N 天）跟随后端日志保留期
- **设置**：账号与两步验证（TOTP）、设备管理、系统设置

两种身份（管理员令牌 / 访问密钥）在 localStorage 各自独立存放、互不干扰，
同一浏览器可共存：管理端请求与管理端用量接口带管理员令牌，
门户专属接口（`/api/key/*`）带访问密钥，由请求作用域自动区分。

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

产物分发是构建后的一步本地复制：把 `dist/` 内容复制到后端仓库的 `web/`
目录，由 rust-embed 嵌入二进制。不要把 `outDir` 指到后端仓库——
跨仓库路径在 CI 里不存在。

## 接口

接口契约见后端仓库根目录的 `API.md`（`github.com/mogumc/aequi`）。

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
├── components/          # 通用组件（layout、ui/ 为 shadcn 组件，另有虚拟滚动、倍率输入）
├── pages/               # 页面模块，一页一目录
├── lib/                 # api 客户端（凭证作用域）、格式化、倍率换算、剪贴板
├── hooks/
└── data/                # 接口数据结构类型
```
