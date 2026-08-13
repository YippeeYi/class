# 全站 UI 交互反馈规范

本规范是业务页面的唯一交互基线。`frontend/src/components/ui` 为只读的 shadcn/ui
组件目录；项目差异仅通过业务层组合、variant、token 与公共样式实现。

## 1. 原则

- 优先使用 shadcn/ui 的组件结构、状态属性、可访问性与响应式行为。
- 状态反馈不得改变布局尺寸或推动相邻内容；按压只允许最多 1px 的短促下移。
- Hover 只在精确指针设备启用，不使用抬升或缩放；触摸设备依靠 Pressed 与 Selected 状态。
- 键盘焦点使用统一的 3px 半透明焦点环，并同步加强边框。
- 禁用态统一为 50% 透明度；异步操作同时设置 disabled 与 aria-busy，避免重复提交。
- 动画只帮助理解状态变化，不承担装饰作用；所有动画服从 prefers-reduced-motion。

## 2. Token

| Token | 值 | 用途 |
| --- | --- | --- |
| --interaction-duration-fast | 120ms | 菜单项、轻量提示、Press |
| --interaction-duration-standard | 160ms | 按钮、输入、选中与弹层 |
| --interaction-duration-slow | 200ms | Sheet 与较大区域反馈 |
| --interaction-duration-scene | 300ms | 背景图片交叉淡入 |
| --interaction-ease-standard | cubic-bezier(0.2, 0, 0, 1) | 全站唯一交互缓动 |
| --interaction-surface-hover | 主题混合色 | Hover 背景 |
| --interaction-surface-pressed | 主题混合色 | Pressed 背景 |
| --interaction-surface-selected | Primary 轻染色 | Selected 背景 |
| --interaction-focus | Ring 半透明色 | 键盘焦点环 |
| --interaction-disabled-opacity | 0.5 | Disabled 与 Loading |

## 3. 控件规范

### 按钮

- 使用项目层 Button 封装，底层保持 shadcn Button；异步操作使用 loading 与 loadingLabel。
- Hover 仅调整背景、边框或文字色；Pressed 使用状态色与 1px 下移；Release 在 160ms 内恢复。
- Default、Secondary、Outline、Ghost、Destructive、Link 保持各自语义色，不引入页面私有按压参数。
- 图标按钮保留可访问名称或 Tooltip；键盘、鼠标和触摸均能得到明确反馈。

### 输入、选择与切换

- Input、Textarea、Select 的 Hover 只加强边框；Focus 使用统一 ring；Invalid 使用 destructive 语义。
- Checkbox、Radio、Switch、Toggle、Tabs 直接使用 shadcn 状态能力。
- SegmentedTabsList 只组合 shadcn TabsList 与 TabsTrigger。切换时直接更新选中项，只过渡颜色、背景与边框，不创建移动指示层。
- Radio 选项卡通过 data-selected 显示独立的边框和背景变化，不使用绝对定位高亮框或 layout 动画。
- 菜单项使用 120ms 颜色/背景过渡，并保持不少于 32px 的行高。

### 卡片、列表与媒体

- 可点击表面使用 interactiveSurfaceVariants；Card、Item、Media 共用 Hover、Pressed、Selected、Focus 与 Disabled token。
- Hover 不改变几何尺寸。媒体提示在 Hover/Focus 显示，在粗指针设备保持可发现。
- 普通文本链接使用 app-text-link；不可点击内容不得使用 pointer 光标。

### 弹层

- Tooltip、Popover、Dropdown 使用 120ms；Dialog 使用 160ms；Sheet 使用 200ms。
- 沿用 shadcn/Base UI 的焦点管理、定位、关闭、滚动锁定和响应式逻辑。
- 全屏图片查看器使用实色半透明蒙层，内容与蒙层只做 160ms 透明度进出。

## 4. 圆角与表面

- 全站只有一套圆角方框体系，由 --radius 及 shadcn 派生 token 控制。
- 控件、组合和面板直接使用 shadcn 派生的 --radius-sm/md/lg/xl；差异只表达尺寸和层级。
- 卡片、弹层和交互选项共用统一的边框、背景和阴影 token，不存在可切换的方框风格配置。
- 阴影仅用于必要层级：静态表面使用 subtle，弹层使用 overlay；Hover 不新增高度或强阴影。

## 5. Sidebar

- 使用 shadcn SidebarProvider、Sidebar、SidebarMenuButton、SidebarTrigger、SidebarRail 与移动端 Sheet。
- collapsible=\"icon\"、宽度过渡、图标排列、内容隐藏、Tooltip 和响应式行为由 shadcn 负责。
- 业务层只提供导航数据、路由预加载与 isActive；不维护额外折叠状态机、不创建移动选中层、不覆盖 Rail 结构。

## 6. 实现约束

- 不修改 frontend/src/components/ui。
- 页面不得新增 transition-all、独立时长、Hover 位移/缩放或自定义弹层动画。
- 只有答题正确/错误、表单错误、成功提示等明确业务状态可以增加语义色。
- 新交互优先扩展项目层 Button、SegmentedTabsList、interactiveSurfaceVariants 或公共 token，避免页面复制近似样式。
- 每次发布前执行静态契约、类型、Lint、构建和浏览器响应式回归；覆盖快速点击、键盘 Focus、弹层开关、滚动及 Sidebar 连续折叠。
