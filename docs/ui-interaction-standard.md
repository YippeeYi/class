# 全站 UI 交互反馈规范

本规范是业务页面的唯一交互反馈基线。shadcn/ui 源码目录保持只读；项目级差异统一由
`frontend/src/components/archive/interaction.tsx` 与 `frontend/src/styles/tailwind.css` 承担。

## 1. 基础原则

- 状态反馈不得改变布局尺寸或推动相邻内容；按压允许在合成层内做 1–4% 的短促定向压缩和不超过
  1px 的重心下移，释放后必须回到完全相同的布局边界。
- Hover 不使用缩放或抬升；只有 Press、弹窗进出、选中实体迁移、折叠和图片手势等具有明确
  空间或物理含义的状态可以使用 transform。
- Hover 只在 `(hover: hover) and (pointer: fine)` 设备生效；触摸设备依靠 `:active`。
- 键盘焦点使用 3px 半透明焦点环，并同步加强边框；不能以 Hover 代替 Focus。
- 禁用态使用 50% 透明度和不可用光标；异步操作通过 `loading` 同时设置 `disabled` 与
  `aria-busy`，避免重复提交。
- 所有动效都服从 `prefers-reduced-motion: reduce`。

## 2. Design token

| Token | 值 | 用途 |
| --- | --- | --- |
| `--interaction-duration-fast` | 120ms | 菜单项、轻量提示 |
| `--interaction-duration-press-in` | 82ms | 指针/键盘按下阶段 |
| `--interaction-duration-release` | 210ms | 松开后的材质稳定与几何复原 |
| `--interaction-duration-standard` | 160ms | 按钮、输入、卡片等常规反馈 |
| `--interaction-duration-slow` | 200ms | 内容进出与较大区域反馈 |
| `--interaction-duration-liquid` | 360ms | 仅用于液体玻璃选中材质的连续塑形 |
| `--interaction-duration-scene` | 500ms | 仅用于全页背景图交叉淡入 |
| `--interaction-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 全站交互缓动 |
| `--interaction-ease-liquid` | `cubic-bezier(0.22, 0.72, 0.18, 1)` | 快响应、无弹跳的材质重新稳定 |
| `--interaction-surface-hover` | 主题混合色 | 浅层 Hover 背景 |
| `--interaction-surface-pressed` | 主题混合色 | Pressed 背景 |
| `--interaction-surface-selected` | Primary 轻染色 | Selected 背景 |
| `--interaction-border-hover` | Primary/Border 混合色 | Hover 边框 |
| `--interaction-border-selected` | Primary/Border 强混合色 | Selected 边框 |
| `--interaction-focus` | Ring 半透明色 | 3px 键盘焦点环 |
| `--interaction-disabled-opacity` | 0.5 | Disabled/Loading 透明度 |

场景时长不用于按钮、卡片、弹窗或任何需要即时响应的控件。

## 3. 控件类别

### 按钮与图标按钮

- 默认/强调按钮：Hover 轻微加深主色；Pressed 使用按尺寸协调的轻微横纵压缩、最多 1px
  重心下移、边框/背景/深度变化，Release 使用统一 210ms 稳定曲线回到原边界。
- Secondary：在 secondary 色阶内加深，保持与主按钮的层级差。
- Outline：Hover 加强边框并出现浅层背景；Pressed 使用更明确的表面色。
- Ghost：无常驻边框，Hover/Pressed 只增加克制的背景。
- Destructive：只使用 destructive 语义色，不借用普通主色反馈。
- Link button：颜色与下划线粗细变化，不改变位置。
- 图标按钮的实际命中区最小为 32×32px；纯图标操作必须有可访问名称或 Tooltip。
- 使用项目 `Button` 封装；异步操作传 `loading`，不要在页面重复拼装状态类。
- `Button` 在 `pointerdown` 只读取一次自身边界并记录按压位置，不注册 `pointermove`、不写 React
  state；键盘 Enter/Space 使用中心点，确保鼠标、触摸和键盘都有完整 Press/Release 反馈。
- 液体玻璃模式的按钮按压由局部照明扩散、纵向压缩、边缘张力、内折射和阴影变浅共同表达；
  不增加独立 `backdrop-filter`，不使用单一 `scale(.95)`、循环果冻或夸张回弹。

### 可点击卡片、列表项与媒体区域

- 使用 `interactiveSurfaceVariants({ kind: 'card' | 'item' | 'media' })`。
- Card：反馈作用在内部 shadcn Card 的背景和边框，不抬升、不缩放。
- Item：整行共享边框、背景、Selected 和 Focus 规则。
- Media：Hover/Focus 显示交互提示；粗指针设备默认显示提示，防止仅靠 Hover 才可发现。
- 选中态使用 `.is-selected`、`aria-current` 或 `aria-selected`；禁用态使用
  `.is-disabled` 或 `aria-disabled`。

### 输入、选择与切换控件

- Input、Textarea、Select：Hover 仅轻微加强边框；Focus 使用 ring；Invalid 使用
  destructive 边框与对应焦点环。
- Checkbox、Radio、Switch、Toggle、Tabs 保留 shadcn 的语义状态，通过统一时长、
  Focus、Disabled 和 Selected token 协调视觉。
- 单选模式切换统一使用项目 `SegmentedTabsList`（内部组合 shadcn Tabs）。普通风格的
  选中背景是单一共享层，以 200ms 标准 easing 在选项间移动；业务状态在点击时立即更新，不等待动画结束。
- 液体玻璃沿用同一语义组件，但选中材质在 360ms 内经历“旧位置—临时融合桥—新位置”。
  主材质轻微拉伸并重新稳定，边缘高光同步迁移，局部焦散通过一份文档级 SVG
  displacement filter 产生；不使用果冻弹跳、波纹或叠加的 `backdrop-filter`。整组只有一次背景采样。
- 选中层及高光层保持稳定 DOM。切换动效读取目标控件的真实边界（包括 Sidebar 项目间距和响应式
  换行），使用 Web Animations API 直接更新合成层；快速中断时读取当前 `transform` 与屏幕可见矩形
  继续，不把纯视觉进度镜像到 React state，也不以 `key` 重建装饰节点。
- 横向流动使用横向拉伸、左右融合桥和横向高光迁移；纵向流动使用纵向重心转移、上下融合桥、
  纵向拉伸及 `skewY/translateY` 高光迁移。二维选项网格按实际位移的主轴自动选择逻辑。
- 风格页配色、背景和方框单选网格使用 `.app-spatial-selection` 与同一选中实体；普通模式快速稳定，
  液体玻璃模式保留连续边缘和低不透明度材质迁移，不能遮挡选项正文。
- 多选 Toggle/Button Group 不使用移动指示器；各项通过 `aria-pressed`、边框、背景和文字色平滑
  过渡，避免让多选语义看起来像单选。
- 打开中的 Select、选中 Tabs 和 `aria-pressed=true` 控件必须有持续可见的 Selected 反馈。
- 菜单与下拉项使用 120ms 背景/颜色过渡，并保持不少于 32px 的行高。

### 文本链接与行内操作

- 普通文本链接使用 `app-text-link`，Hover 改色并显示下划线，Focus 显示可见焦点环。
- 卡片内辅助动作使用 `app-inline-action`，由父级 Hover/Focus 协同强调。
- 不可点击文本、图表扇区和纯展示卡片不得使用 pointer 光标。

### 方框与大图层级

- 全站圆角只由 `--radius` 及其 Tailwind 派生 token 控制；方框风格只提供“利落小角”、
  “标准圆角”、“液体玻璃”三档。容器、组、控件使用 `--radius-panel`、`--radius-group`、
  `--radius-control`；3px 内缩选中层使用 `--radius-concentric-inset = group radius - inset`。
  液体玻璃组与内层控件根据实际 border + padding 使用 `--glass-radius-control`（3px 内缩）或
  `--glass-radius-control-tight`（4px 内缩）保持平行圆弧，内层不得复制外层半径。
- 圆角切换只过渡 `border-radius`，不得改变盒模型尺寸、间距或内容位置。
- 原生 scrollbar 与 shadcn `ScrollArea` 共用 `--scrollbar-edge-inset` 和
  `--scrollbar-thumb-radius`；大圆角增加上下缩进，滚动根容器裁切越界边缘。玻璃 thumb 仅使用稳定高光，不单独采样背景。
- 大图模式必须保留真实当前页面为底层；全屏 overlay 使用半透明压暗与一次
  `backdrop-filter`，查看器视口保持透明。不得用打开的图片副本、纯色画布或截图伪造背景。
- 大图 overlay 与内容均以 160ms 透明度进出；模态层沿用 Base UI 的焦点陷阱与滚动锁定，关闭后
  恢复原焦点和滚动位置。`prefers-reduced-transparency` 与不支持 backdrop-filter 的浏览器使用
  更深但仍稳定的降级蒙版。

## 4. 实现约束

- 业务代码从 `@/components/archive/interaction` 引入 `Button`、`buttonVariants`、
  `interactiveSurfaceVariants`、`textLinkClassName` 等项目级契约。
- 单选模式切换从 `@/components/archive/segmented-tabs` 引入 `SegmentedTabsList`；页面不得再次
  为同语义 Tabs 独立拼装选中背景和过渡。
- 不直接修改 `frontend/src/components/ui`；新增视觉规则应放在项目封装、CSS variable、
  公共 class 或 variant 中。
- 页面不得新增 `transition-all`、Hover 位移/缩放、独立阴影尺度或与本规范冲突的时长。
- 选择迁移动画仅允许 `transform` 与 `opacity`；禁止动画 `border-radius`、`clip-path`、宽高、
  `backdrop-filter` 或阴影层。`will-change` 只在 `[data-selection-switching]` / `:active` 期间启用。
- 只有具备独立语义的业务控件可以增加局部状态色，例如答题正确/错误、表单错误和成功提示。
- 侧边栏选中态使用整行共享背景和图标/文字颜色，不使用左侧竖条。右缘保留 shadcn
  `SidebarRail` 的展开/收起语义和 18px 热区，但项目样式必须移除其竖线与 resize 光标，只在
  Hover/Focus 时显示圆形箭头提示，且不可遮挡更深处的主体点击。
- 记录标记产生的注释和插图 HoverCard 在打开时监听捕获阶段的 `scroll`。任一包含触发器的滚动祖先
  发生纵向位移即执行一次标准 120ms 退出并关闭；滚动未结束时不得因静止指针自动重新打开。

## 5. 液体玻璃参考边界

实现依据 Apple 公开的 Liquid Glass 原则：玻璃是控件和导航所在的功能层，背后内容仍应可感知；
连续形变应通过共享容器内的形状融合完成，而不是两块独立材质各自淡入淡出；同时保持可读性、性能与减少动效/透明度适配。
参考：Apple 的 [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)、
[Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials) 与
[Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)。
