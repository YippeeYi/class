# 全站 UI 交互反馈规范

本规范是业务页面的统一交互基线。`frontend/src/components/ui` 是只读的 shadcn/ui 组件目录；
业务页面只要已有对应 shadcn 组件，就必须直接组合该组件及其官方 API，不新增同义封装或自制基础控件。

## 1. 组件使用边界

- 按钮、输入框、文本域、选择器、单选、多选、开关、标签页、菜单、弹窗、抽屉、提示、表格、卡片、
  骨架屏、空状态、分页及侧边栏优先直接使用 `@/components/ui/*`。
- `frontend/src/components/archive/interaction.tsx` 只保留 shadcn 没有覆盖的业务表面与文本链接样式，
  不导出 Button、variant 或基础交互状态机。
- 业务组件可以组合 shadcn 组件，但不得复制 shadcn 已有组件、修改 shadcn 源码或绕过其可访问性语义。
- 原生元素只用于没有对应 shadcn 语义的正文、媒体画布、图表与必要的结构元素。

## 2. 状态标准

- Default：使用主题 token，不额外改变布局或创建装饰层。
- Hover：仅在精细指针设备生效；使用轻微背景、边框或文字色变化，不移动、抬升或缩放真实命中区。
- Pressed：反馈即时、克制；不改变盒模型尺寸，释放后恢复原状态。
- Focus：保留 shadcn 的 `focus-visible` ring，键盘操作不得依赖 Hover 才可见。
- Selected：由组件自身的 `data-state`、`data-active`、`aria-selected`、`aria-pressed` 或业务语义类表达；
  不叠加共享移动选中框。
- Disabled/Loading：同时阻止重复操作并保持可读；异步按钮设置 `disabled` 与 `aria-busy`，使用 shadcn Spinner。
- Invalid/Success：只使用对应语义色，不借用普通 Hover 或 Selected 状态。

## 3. 动效 token

| Token | 值 | 用途 |
| --- | --- | --- |
| `--interaction-duration-fast` | 120ms | 菜单项与轻量提示 |
| `--interaction-duration-press-in` | 82ms | 按下反馈 |
| `--interaction-duration-release` | 210ms | 松开恢复 |
| `--interaction-duration-standard` | 160ms | 常规控件反馈 |
| `--interaction-duration-slow` | 200ms | 内容与较大区域反馈 |
| `--interaction-duration-scene` | 500ms | 全页背景图交叉淡入 |
| `--interaction-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 全站统一缓动 |

- 场景时长不得用于按钮、菜单或连续选择操作。
- 页面不得新增 `transition-all`、循环动画、弹跳、果冻效果或与 token 冲突的任意时长。
- `prefers-reduced-motion: reduce` 下停止非必要动画，并将必要状态切换压缩为近即时反馈。

## 4. 选择控件

- Tabs 直接使用 shadcn `Tabs`、`TabsList`、`TabsTrigger`、`TabsContent`。
- RadioGroup、Checkbox、Switch、Toggle 和 ButtonGroup 直接使用对应 shadcn 组件。
- 风格页的配色、背景与方框选择在目标自身更新颜色、边框、透明度和选中标记；不得使用 shared layout、
  translate、滑块平移、桥接层或从旧选项移动到新选项的选中实体。
- 快速连续选择应立即更新业务状态，不等待动画结束。

## 5. 方框风格

- 方框风格仅保留“利落小角”“标准圆角”“圆角方框”三档，分别映射 `compact`、`default`、`rounded`。
- 三档只调整统一圆角与滚动条边缘缩进，不改变布局、尺寸、间距、背景、阴影或业务逻辑。
- 圆角方框采用普通 Card、Border、Background 与状态 token，不附加模糊、折射、透光、跟随高光、
  流动、融合、焦散或额外材质层。
- 原生 scrollbar 与 shadcn `ScrollArea` 共用 `--scrollbar-edge-inset` 和 `--scrollbar-thumb-radius`。

## 6. Sidebar

- 应用侧边栏直接使用 shadcn `SidebarProvider`、`Sidebar`、`SidebarHeader`、`SidebarContent`、
  `SidebarGroup`、`SidebarGroupContent`、`SidebarGroupLabel`、`SidebarMenu`、`SidebarMenuItem`、
  `SidebarMenuButton`、`SidebarFooter`、`SidebarTrigger`、`SidebarRail` 与 `SidebarInset`。
- 展开、icon collapse、移动端 Sheet、快捷键、Tooltip、active、focus、hover 与 Rail 交互由官方组件负责。
- 业务层只提供现有导航数据、路由 active 判断、预加载和登出逻辑；不得另建折叠状态机、宽度动画、
  自定义 Rail 或移动选中层。

## 7. 业务交互补充

- 可点击业务卡片与列表项使用 `interactiveSurfaceVariants`，但内部基础结构仍组合 shadcn Card 等组件。
- 文本链接使用 `textLinkClassName`；纯展示内容不得使用 pointer 光标。
- 图片查看器直接组合 shadcn Dialog，保留其焦点管理、关闭语义与滚动锁定。
- 注释和插图浮层在包含触发器的滚动祖先发生纵向位移时关闭，避免浮层与锚点错位。
