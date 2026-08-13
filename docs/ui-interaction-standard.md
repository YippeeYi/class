# 全站 UI 交互反馈规范

本规范是业务页面的唯一交互反馈基线。shadcn/ui 源码目录保持只读；项目级差异统一由
`frontend/src/components/archive/interaction.tsx` 与 `frontend/src/styles/tailwind.css` 承担。

## 1. 基础原则

- 状态反馈只改变颜色、背景、边框、阴影或透明度，不改变控件尺寸，不移动文字和图标。
- 常规反馈不使用缩放、抬升或位移；弹窗进出、折叠和图片手势等有空间含义的动效除外。
- Hover 只在 `(hover: hover) and (pointer: fine)` 设备生效；触摸设备依靠 `:active`。
- 键盘焦点使用 3px 半透明焦点环，并同步加强边框；不能以 Hover 代替 Focus。
- 禁用态使用 50% 透明度和不可用光标；异步操作通过 `loading` 同时设置 `disabled` 与
  `aria-busy`，避免重复提交。
- 所有动效都服从 `prefers-reduced-motion: reduce`。

## 2. Design token

| Token | 值 | 用途 |
| --- | --- | --- |
| `--interaction-duration-fast` | 120ms | 菜单项、轻量提示 |
| `--interaction-duration-standard` | 160ms | 按钮、输入、卡片等常规反馈 |
| `--interaction-duration-slow` | 200ms | 内容进出与较大区域反馈 |
| `--interaction-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 全站交互缓动 |
| `--interaction-surface-hover` | 主题混合色 | 浅层 Hover 背景 |
| `--interaction-surface-pressed` | 主题混合色 | Pressed 背景 |
| `--interaction-surface-selected` | Primary 轻染色 | Selected 背景 |
| `--interaction-border-hover` | Primary/Border 混合色 | Hover 边框 |
| `--interaction-border-selected` | Primary/Border 强混合色 | Selected 边框 |
| `--interaction-focus` | Ring 半透明色 | 3px 键盘焦点环 |
| `--interaction-disabled-opacity` | 0.5 | Disabled/Loading 透明度 |

## 3. 控件类别

### 按钮与图标按钮

- 默认/强调按钮：Hover 轻微加深主色，Pressed 再加深；几何与阴影不跳变。
- Secondary：在 secondary 色阶内加深，保持与主按钮的层级差。
- Outline：Hover 加强边框并出现浅层背景；Pressed 使用更明确的表面色。
- Ghost：无常驻边框，Hover/Pressed 只增加克制的背景。
- Destructive：只使用 destructive 语义色，不借用普通主色反馈。
- Link button：颜色与下划线粗细变化，不改变位置。
- 图标按钮的实际命中区最小为 32×32px；纯图标操作必须有可访问名称或 Tooltip。
- 使用项目 `Button` 封装；异步操作传 `loading`，不要在页面重复拼装状态类。

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
- 打开中的 Select、选中 Tabs 和 `aria-pressed=true` 控件必须有持续可见的 Selected 反馈。
- 菜单与下拉项使用 120ms 背景/颜色过渡，并保持不少于 32px 的行高。

### 文本链接与行内操作

- 普通文本链接使用 `app-text-link`，Hover 改色并显示下划线，Focus 显示可见焦点环。
- 卡片内辅助动作使用 `app-inline-action`，由父级 Hover/Focus 协同强调。
- 不可点击文本、图表扇区和纯展示卡片不得使用 pointer 光标。

## 4. 实现约束

- 业务代码从 `@/components/archive/interaction` 引入 `Button`、`buttonVariants`、
  `interactiveSurfaceVariants`、`textLinkClassName` 等项目级契约。
- 不直接修改 `frontend/src/components/ui`；新增视觉规则应放在项目封装、CSS variable、
  公共 class 或 variant 中。
- 页面不得新增 `transition-all`、Hover 位移/缩放、独立阴影尺度或与本规范冲突的时长。
- 只有具备独立语义的业务控件可以增加局部状态色，例如答题正确/错误、表单错误和成功提示。

