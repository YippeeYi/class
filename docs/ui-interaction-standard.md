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
- Pressed：按钮在 82ms 内以合成层缩放至约 `0.985 × 0.97` 并下移 `0.75px`，210ms
  平滑恢复；不得改变盒模型、命中区或周围布局。Disabled、Loading 不执行正常按压反馈。
- Focus：保留 shadcn 的 `focus-visible` ring，键盘操作不得依赖 Hover 才可见。
- Selected：由组件自身的 `data-state`、`data-active`、`aria-selected`、`aria-pressed` 或业务语义类表达；
  紧凑分段模式切换与全局 Sidebar 导航可以增加一个不接管状态的共享选中层。
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

- Tabs 直接使用 shadcn `Tabs`、`TabsList`、`TabsTrigger`、`TabsContent`。记录模式、人物记录模式和
  统计指标通过 `SegmentedTabsList` 组合这些原语，只扩展原有的共享选中层移动，不复制 Tabs 状态机。
- RadioGroup、Checkbox、Switch、Toggle 和 ButtonGroup 直接使用对应 shadcn 组件。
- 分段模式选中层读取真实 TabsTrigger 布局边界，以 200ms 标准缓动移动；快速连续选择从当前可见位置
  继续且始终只保留一个动画，Reduced Motion 下即时落位。
- 风格页顶层“配色 / 背景 / 方框”使用与其他分段模式一致的共享选中层；各分区内部的配色卡、背景卡
  与方框卡仍在目标自身更新颜色、边框和选中标记，不跨长距离移动选择框。
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
- 业务层只提供导航数据、路由 active 判断、预加载、登出逻辑，以及位于官方 `SidebarMenuButton`
  背后的单一共享选中层；不得另建折叠状态机、宽度动画或自定义 Rail。
- Sidebar 右边界只由官方 Sidebar 容器绘制；`SidebarInset` 不得重复绘制相邻边线，Rail 保留命中区但
  不产生第二条错位边界。

## 7. 业务交互补充

- 可点击业务卡片与列表项使用 `interactiveSurfaceVariants`，但内部基础结构仍组合 shadcn Card 等组件。
- 文本链接使用 `textLinkClassName`；纯展示内容不得使用 pointer 光标。
- 图片查看器直接组合 shadcn Dialog，保留其焦点管理、关闭语义与滚动锁定。
- 注释和插图浮层在包含触发器的滚动祖先发生纵向位移时关闭，避免浮层与锚点错位。

## 8. 图表与答题反馈

- 图例高亮以整个图例容器为交互边界：进入新项目时切换，经过项目间距时保留上一个项目，只有指针
  离开完整图例区域后才清除。键盘焦点独立保留，不能被一次无关的 Pointer Leave 擦除。
- 同一组图例统一复用 `usePersistentHighlight`，不在每个图例按钮上分别实现 Leave/Blur 清空逻辑。
- 饼图只用透明度与边界色表达关联高亮，不放大扇形、不改变半径或布局；图表数据切换时同步清理旧高亮。
- 答题提交结果由一个 `result` 状态同时驱动题卡边界、题目内容底色、答案控件、提交按钮与固定页脚，
  正确和错误使用主题语义 token。结果动画只执行一次短距离淡入，不能阻塞“下一题”。
- 最终答案提交使用同步锁防止快速重复计分；隐藏题的长度错误、部分正确与重试仍属于可继续输入状态，
  不得错误锁定或提前累计分数。
