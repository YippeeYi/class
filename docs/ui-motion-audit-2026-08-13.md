# 全站 UI、反馈与动画体系审查（2026-08-13）

## 结论

本轮在既有 React 19 + shadcn/Base UI 架构上完成了项目级交互体系重构，没有修改
`frontend/src/components/ui`，没有改变路由、数据、权限、筛选、答题、图片签名或其他业务逻辑。

统一入口：

- `frontend/src/components/archive/interaction.tsx`：Button、loading、按压触点与公共交互契约。
- `frontend/src/components/archive/selection-motion.tsx`：横向、纵向及二维选项网格的共享选中实体。
- `frontend/src/components/archive/segmented-tabs.tsx`：基于 shadcn Tabs 的 segmented control。
- `frontend/src/styles/tailwind.css`：时长、缓动、表面、焦点、按压、材质、圆角与降级 token。
- `docs/ui-interaction-standard.md`：业务页面唯一交互规范。

## Apple 资料到实现的映射

- Apple 将 Liquid Glass 定义为悬浮在内容之上的控件/导航功能层，因此正文 Card 继续使用安静的
  标准材质；Sidebar、顶栏、弹窗、分段控件及交互按钮才使用玻璃表现。
- `GlassEffectContainer` 强调同一容器中的一次组合渲染、相邻形状融合与形变。本项目保持一个稳定
  selection DOM，使用临时 bridge 表达连接，不创建新旧两块各自淡入淡出的玻璃。
- Apple 的 Dynamics 案例强调 lensing、边缘高光、交互时内部点亮、拉伸和形变。项目按钮在
  pointerdown 仅记录一次触点，以局部照明、定向压缩、边缘/阴影变化和释放稳定共同反馈。
- Apple 指出触控反馈应强于 trackpad，Reduced Motion 会降低强度并移除弹性。项目对粗指针保留
  清晰 Press 反馈，并由全局 Reduced Motion 规则将动画压缩到 0.01ms。
- Apple 展示的窗口和控件保持 concentricity。本项目新增 3px/4px 两档玻璃内缩圆角 token，分别
  对应 group 的实际 border + padding，避免内层复制外层圆角。

参考：

- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [WWDC25: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)
- [GlassEffectContainer](https://developer.apple.com/documentation/swiftui/glasseffectcontainer)
- [web.dev: Animations and performance](https://web.dev/articles/animations-and-performance)

## 核心修改

### 按钮

- 普通模式统一 82ms Press / 210ms Release；按尺寸使用约 1.5–4.8% 的克制定向压缩与最多 1px 位移。
- 液体模式增加触点局部光、高光迁移、边缘张力、深度变浅和释放稳定；不是单一 scale/opacity。
- 每次按压只读取一次边界，不监听 pointermove，不进入 React state；键盘使用控件中心点。
- Hover、Focus、Pressed、Selected、Disabled、Loading 继续共享项目 token；异步按钮同时设置
  `disabled` 与 `aria-busy`。

### 选中迁移

- 不再以 `index × width/height` 假设等间距，改为读取真实目标边界；Sidebar 的 `gap`、响应式换行和
  不同尺寸的风格选项均能精确落点。
- 普通模式只运行一个移动动画；液体模式为 move、reshape、bridge、lens 四个有界动画。
- 横向使用 `scaleX/translateX/skewX`，纵向使用独立的 `scaleY/translateY/skewY` 与上下融合桥。
- 快速切换读取当前合成 transform 和可见矩形继续，动画数量保持有界，不创建 React paint state。
- 风格页“配色 / 背景 / 方框”三组 RadioGroup 接入 `.app-spatial-selection`，选中实体可跨行移动和变形。

### 性能与材质

- Selection 动画只修改 transform/opacity；移除了动画中的 border-radius 和 clip-path。
- backdrop-filter 只留在有界功能层；按钮、选中实体和内容 Card 不重复采样背景。
- `will-change` 只在切换或按压期间启用；ResizeObserver 只在容器几何实际变化后以 rAF 校正静止落点。
- SVG displacement 只作用于小型高光层，不作用于背景模糊层。

### Sidebar

- 继续直接使用 shadcn `SidebarProvider`、`Sidebar collapsible="icon"`、`SidebarTrigger`、
  `SidebarRail`、mobile Sheet 与官方宽度过渡；没有新增折叠状态机或自定义宽度动画。
- 项目层仅负责颜色、玻璃材质、Rail 提示和垂直选中实体。

## 验证

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test`：13 组安全、缓存、图片、记录、答题、搜索和静态契约通过。
- `npm run test:layout`：通过；覆盖 1280、768、390、320 CSS px 与 1.25×/2× DPR。
- 交互回归覆盖：Hover、键盘 Focus、Press/Release、禁用、selected、快速 segmented 切换、液体
  横向/纵向切换、Reduced Motion、三种方框反复切换、8 次连续 Sidebar 折叠/展开、Sidebar 三项
  快速中断、图片查看器、Scrollbar、圆角裁切和 console/page error。
- 应用内浏览器人工复核了桌面和 390×844 视口下的配色、方框和液体材质；选中层不再遮挡内容，
  横向和纵向迁移均按各自轴向运行。
- `git diff -- frontend/src/components/ui`：应保持为空。

## 环境边界

本地没有可用的一次性生产邀请码，因此真实 Supabase RLS 数据规模、私有图片续签和线上网络条件仍需
在预发布环境用受控普通/admin 邀请码完成最终数据链路验收。本轮通过受控缓存数据和真实浏览器组件
完成 UI/交互验证，没有伪造生产 token、读取邀请码或放宽权限。
