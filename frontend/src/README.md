# 前端源码约定

本目录是 React 19 + TypeScript 单页应用源码。结构按职责分层，但只抽取已经产生复用价值或拥有独立状态边界的代码：

- `pages/`：路由页面，负责组合业务区块，不放跨页面基础设施。
- `features/`：认证、档案数据、测验等具有独立状态或规则的业务模块。
- `components/layout/`：应用外壳、导航、背景等跨页面布局。
- `components/archive/`：档案领域中实际跨页面复用的展示组件。
- `components/ui/`：由 shadcn CLI 下载的 Base UI 组件源码，只通过 CLI 管理。
- `services/`：Supabase 和远端数据访问；React 组件不直接拼接请求。
- `lib/`：无 React 状态的解析器与通用函数。
- `types/`：共享领域类型。

页面路由在 `app.tsx` 中按需加载。档案公共数据通过 `ArchiveProvider` 共享，手写页、地图、背景等页面专属数据在对应视图挂载后再加载。记录正文先解析为类型化 AST，再直接渲染为 React 节点，不经过 HTML 字符串或 DOM API。

避免为单次使用、没有独立状态的局部 JSX 创建文件；当一段 UI 被多个页面复用，或拥有清晰的数据加载与交互边界时再抽成组件。
