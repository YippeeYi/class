# 全站 UI、反馈与动画审查（2026-08-13）

## 结论

本轮在既有 React 19、shadcn/ui 与 Base UI 架构上统一了业务组件的状态和动效契约，未修改
`frontend/src/components/ui`，未改变路由、数据、权限、筛选、答题、图片签名及其他业务逻辑。

## 组件审查

- 业务按钮统一直接使用 shadcn Button；加载态组合 shadcn Spinner，并设置 `disabled` 与 `aria-busy`。
- Tabs、ButtonGroup、Dialog、Card、RadioGroup、ScrollArea、Sidebar 等已有组件均直接使用 shadcn 实现。
- `interaction.tsx` 不再包装 Button，只保留 shadcn 没有提供的业务卡片、列表、媒体和文本链接契约。
- 图片查看器改为直接组合 shadcn DialogContent，继续使用官方 overlay、焦点陷阱与关闭行为。

## 状态与动画

- Hover、Pressed、Focus、Selected、Disabled 和 Loading 使用同一组主题、边框、焦点与时长 token。
- 常规反馈集中在 82–210ms；全页背景交叉淡入单独使用 500ms 场景时长。
- 普通、图标、工具栏、Sidebar 与复合组件按钮共享 `0.985 × 0.97`、`0.75px` 的合成层 Press 反馈；
  不改变布局或命中区，Disabled 与 Loading 自动排除。
- 记录显示模式、人物记录模式和统计指标恢复原有单一移动选中层；动画基于真实 shadcn TabsTrigger
  边界，并在快速切换时从当前可见位置继续。
- 风格页顶层“配色 / 背景 / 方框”恢复单一共享选中框；分区内部的长距离卡片选择仍在目标自身即时更新。
- 移除了背景预览 Hover 缩放与图表入场动画；记录跳转提示使用统一场景 token。
- Reduced Motion 继续关闭非必要动效。

## 方框风格

- 第三种方框已替换为普通“圆角方框”，内部 id 为 `rounded`。
- 方框选项只保留 `compact`、`default`、`rounded`，仅调整圆角体系与滚动条边缘缩进。
- 三种预览使用不同的微型界面图案，并精确复用对应的 Card、Control 与 inset 圆角比例。
- 圆角方框不使用特殊材质、额外图层、SVG 过滤器、指针跟随状态或独立动画。
- 与旧第三种方框专用的组件、条件、变量、样式和运行时代码已删除。

## Sidebar

- 应用侧边栏直接使用 shadcn Sidebar 全组件族及 `collapsible="icon"` 标准 API。
- 导航 active 状态继续由 `SidebarMenuButton isActive` 负责；一个共享选中面只读取真实按钮边界并在
  目标间移动，不接管路由、键盘或折叠状态。
- 展开、收起、Rail、移动端 Sheet、Tooltip、focus 与 hover 保持官方行为；未新增并行折叠状态机或
  自定义 Rail。主内容不再重复绘制 Sidebar 相邻边线。

## 回归范围

- 静态契约覆盖直接 shadcn 引用、方框枚举、Sidebar 结构、按钮 Press、分段选择移动及无基础组件重复封装。
- 浏览器布局回归覆盖 1280、768、390、320 CSS px 与 1.25×/2× DPR，并验证三档圆角、滚动条、
  Sidebar 连续折叠、选择状态、图片查看器、主题切换和控件几何稳定。
- `git diff -- frontend/src/components/ui` 必须为空，确保 shadcn 源码目录保持只读。
