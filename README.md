# Aequi AI - 负载均衡管理面板

Aequi AI 的 Web 管理面板，提供对大语言模型负载均衡系统的可视化管理和实时监控。

## 技术栈

- **框架**: React 19 + TypeScript
- **UI 组件库**: Material UI (MUI) v9
- **图表**: Chart.js + react-chartjs-2
- **路由**: react-router-dom (HashRouter)
- **构建工具**: Vite 6

## 功能概览

### 📊 仪表盘
- 核心运行状态统计卡片（RPM、成功率、平均延迟、总请求数、Token 用量、进行中请求）
- 上游状态表格（请求数、状态码分布、错误数、活跃密钥数、负载条形图）
- 请求趋势折线图（支持 1m/5m/30m/1h 时间窗口切换）
- **SSE 实时推送**：通过 Server-Sent Events 实时获取统计更新，自动重连

### 🔗 上游管理
- 上游节点 CRUD（基础 URL、权重、格式、代理、模型映射等）
- 密钥管理（查看、批量添加、批量删除、释放冷却密钥）
- 模型路由映射（搜索模型、勾选配置、全选/取消）
- 模型倍率管理（输入/输出倍率 CRUD）

### 💰 计费密钥
- 费用概览（密钥总数、活跃数、无限额度数、耗尽数、余额统计）
- 模型倍率表格
- 上游密钥概览
- 计费密钥管理（查询、创建、余额调整、等级设置、删除）
- 密钥快速生成 `hs-xxx` 格式，支持无限额度开关

### 📋 请求历史
- 请求记录表格（时间、客户端 IP、模型、状态码、延迟、Token 用量、上游）
- 多字段搜索过滤（IP、模型、上游、路径等）
- 分页加载（支持 50/100/200/500/1000 条显示）
- 自动刷新（每 5 秒轮询）
- 请求详情查看（含原始 JSON）

### ⚙️ 系统配置
- 查看当前系统配置（键值对表格）
- 刷新配置 & 重建索引

### 🎨 主题
- 亮色 / 暗色 / 跟随系统 三种主题模式
- 基于 `prefers-color-scheme` 自动检测系统主题
- 主题偏好持久化到 localStorage

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

默认启动在 `http://localhost:5173`，开发服务器自动将 `/admin` 和 `/health` 路径代理到 `http://127.0.0.1:8080`。

### 构建生产版本

```bash
npm run build
```

产物输出到 `dist/` 目录。

### 预览构建结果

```bash
npm run preview
```

## 部署

构建后 `dist/` 目录即为静态文件，可部署到任意 Web 服务器或 CDN。

默认部署基路径为 `/web/`，如需修改请编辑 `vite.config.ts` 中的 `base` 配置。

## API 代理

开发模式下，Vite 代理配置如下：

| 前端路径 | 代理目标 |
|---------|---------|
| `/admin` | `http://127.0.0.1:8080` |
| `/health` | `http://127.0.0.1:8080` |

生产部署时需在项目 Aequi 中将构建产物复制到 \src\static\dist 并重新编译。  

*你也可以直接使用 Nginx 反向代理。*  

## 认证

所有 API 请求需携带 `X-Admin-Token` 请求头。Token 通过前端对话框配置，持久化存储在 `localStorage` 中。

## 项目结构

```
src/
├── api/
│   └── client.ts          # API 客户端，封装所有后端接口及类型定义
├── components/
│   └── ErrorBoundary.tsx   # 全局错误边界组件
├── contexts/
│   └── ThemeModeContext.tsx # 主题模式上下文（亮色/暗色/跟随系统）
├── pages/
│   ├── Dashboard.tsx       # 仪表盘 - 统计数据与实时监控
│   ├── Upstreams.tsx       # 上游管理 - 节点、密钥、模型路由
│   ├── Billing.tsx         # 计费密钥管理
│   ├── Requests.tsx        # 请求历史查询
│   ├── Config.tsx          # 系统配置查看
│   └── NotFound.tsx        # 404 页面
├── App.tsx                 # 主应用组件（导航、路由、Token 配置）
├── main.tsx                # 应用入口
├── theme.ts                # MUI 主题配置
└── vite-env.d.ts           # Vite 类型声明
```

## License

MIT License  
