# 《当前版本差异审查报告》

对照基准：`b0923d471abbf85f0bf88fbb635cefbbbb041e37`  
当前架构：React 19、TypeScript、Vite、Tailwind CSS v4、shadcn/ui Base UI、React Router、Supabase JS。

## 1. 总体判断

当前版本的 React 分层、路由懒加载、类型化正文 AST、共享 Archive Context、shadcn Sidebar 和页面级组件化是合理且应保留的现代化方向；不是回退目标。但迁移首版只覆盖了主要页面的“可见主路径”，基线中大量数据边界、图片生命周期、深层交互和统计能力被简化。

分类统计采用：A 完整；B 缺失；C 存在但体验/安全下降；D 实现不同但理念一致。

## 2. 逐项对照表

| 旧版本功能 | 当前实现 | 分类 | 差异与处理方案 |
| --- | --- | --- | --- |
| 独立 HTML 页面导航 | React Router + lazy routes | D | SPA 更合理；保留并补齐精确跳转、URL 状态和 GitHub Pages 刷新路径 |
| 全站左侧导航 | shadcn `Sidebar` 官方层级 | A | 已使用 Provider/Sidebar/Content/Menu/Inset/Trigger；保留 |
| 一次性邀请码与服务端刷新 | `AuthProvider` RPC | A/D | 核心存在；补 bfcache 复验和彻底缓存清理 |
| 90/365 天规则 | `readCandidate` | A | 规则一致 |
| 全站缓存擦除 | 仅 local/session、内存 promise | C | 未清 IndexedDB、Cache Storage、SW、对象 URL；建立统一 cleanup service |
| 授权纪元三级数据缓存 | 只有进程内 Promise Map | B | 恢复 session + IndexedDB + stale 回退；hidden 禁持久化 |
| bfcache 安全 | 无 pageshow 复验/重签 | B | AuthProvider 和资源服务补 pageshow/pagehide |
| Supabase 请求头/RLS | token 分 client | A | 保留 |
| 签名 URL 600/180 秒与提前刷新 | 单一默认 180 秒且永久 promise 缓存 | C | 按敏感路径分寿命，缓存 expires/refreshAt，force refresh |
| 图片变体、Cache Storage、并发队列 | 无 | B | 建立 image resource service；至少恢复去重、刷新、对象 URL 回收和 written transform |
| 统一递归标记 AST | `lib/markup.ts` | D | 类型化 AST 优于 innerHTML；继续补齐行为契约 |
| 未知/非法标记显示原文 | 部分分支返回第二段而非 raw | C | 未知有分隔符标记被吞掉；改为 raw 文本 |
| 注释 hover/focus/touch | 原生 `title` | C | 使用 shadcn Tooltip/Popover 组合，补键盘与触摸 |
| 插图 hover 预览、尺寸预热 | 仅点击后 Dialog | B | 补预览和安全图片 loader；Dialog 保留作大图入口 |
| 图片滚轮缩放/拖动/fit | 只有普通可滚动 Dialog | C | 新建业务 wrapper，内部仍用 shadcn Dialog，恢复 zoom/pan |
| 记录附件签名与打开 | Button + sign + window.open | D | 主流程一致；补错误反馈与过期刷新 |
| 记录列表/书面双视图 | Tabs + page loader | C | 主体存在；缺页消息、补充、无普通记录页、下拉跳页、相邻预载、hidden written |
| 日期/重要/关键词筛选 | React state + URL | C | 缺 `excludeDaily`，清除条件未包含 day，书面筛选源不完整 |
| 精确记录跳转和返回原位置 | hash 链接 | B | 无平滑聚焦、目标高亮、返回对话框、筛选恢复 |
| hidden 键序列 | 已实现 | C | 只支持列表并额外给普通用户错误；基线静默失败、支持隐藏书面页 |
| 人物三分组同时展示 | Tabs 只展示一个角色 | C | 恢复三个 section 独立状态或响应式折叠，不退回手写下拉 |
| 老师固定学科顺序/主要置顶 | 普通 localeCompare，无 main toggle | B | 恢复固定序与“主要”Toggle |
| 人物详情头像 | 未见完整签名头像流程 | B/C | 恢复 Avatar、签名失败 fallback |
| 人物页记录筛选 | 仅参与/记录 Tabs | B | 复用 RecordFilters 业务组件 |
| 名言排序/来源跳转 | Select、排序按钮、Link | A/D | 视觉更现代；补 0/多来源错误处理和跳转上下文 |
| 搜索 URL、120ms 防抖 | 无 URL 初始化/同步、防抖 | B | 恢复 |
| 搜索评分/摘要/高亮/分组 | 简单 includes、平铺卡片 | C | 恢复权重、分组和 `<mark>` 摘要 |
| 搜索全部结果 | `.slice(0, 100)` | B | 删除截断；必要时只做渲染性能优化，不改变结果集 |
| 资料 id 直达与正文 | 已实现 | A/D | 保留；补无效 id 说明和插图预热由共享 loader 处理 |
| 答题普通来源 | 仅普通 records | C | 缺页消息/补充；生成算法被简化 |
| 答题筛选约束/等权 | 页面筛选与随机题 | C | 恢复 source→content→type 等权和不可取消最后可生成项 |
| 判断题多点替换校正 | 简化题干 | B | 移植纯 TypeScript quiz engine 行为 |
| admin lamian | 键序列和私有题图存在 | C | 需核对只在 admin 后查询、方框逐字符反馈、URL 刷新 |
| 时间线总览/月分布 | 基础卡片和月份柱 | C | 缺年度层、每日、作者饼图、人物/名言热度、chips 和固定刻度 |
| 私有地图 | 签名图 + Dialog | C | 缺签名定时刷新、加载错误重试、真正 zoom/pan |
| 背景选择 | 三选项、localStorage | D/C | 选择存在；动态 palette、缓存、预览重试、署名安全链接和全屏偏好丢失 |
| 致谢 | shadcn Card + 标记 | A | 保留 |
| Loading/Empty/Error | shadcn Skeleton/Empty + wrapper | A/D | 基本规范；个别图片状态需 Spinner + retry |
| 清除访问确认 | `window.confirm` | C | 按官方示例改为 shadcn AlertDialog，不改 ui 源码 |
| 页面视觉体系 | tokens、Card、Button、Select、Tabs 基本一致 | D/C | 首页次级入口和部分业务按钮仍手写 card 外观；减少额外圆角/阴影，统一密度 |
| 暗色主题 tokens | CSS 已定义 `.dark` | C | 无切换/系统同步；图片背景下的对比度需验证 |
| CSP/静态安全 | Vercel 配置保留 | A | GitHub Pages 无响应头能力是平台限制；运行时代码仍需避免泄漏 |
| 管理脚本/SQL | 原样保留 | A | 不因 React 改动重写 |

## 3. shadcn 规范审查

### 已正确使用

- Sidebar 使用官方 Base UI 组合：`SidebarProvider → Sidebar → Header/Content/Footer → Menu`，主区为 `SidebarInset`，移动端行为由组件自身 Sheet 处理。
- 页面主要控件已使用下载到仓库的 Button、Card、Select、Tabs、Table、Alert、Dialog、Empty、Skeleton、Spinner。
- `frontend/src/components/ui` 是 CLI 管理的原生组件目录，本轮不修改、不复制分叉版本。

### 需要调整

- 移除访问权限属于破坏性确认，应按官方 `AlertDialog` 的 Header/Title/Description/Footer/Cancel/Action 组合实现，替换 `window.confirm`。
- 业务级大图查看器可用 shadcn `Dialog` 做可访问外壳，zoom/pan 是领域行为，放在 `components/archive` wrapper 中，不改 Dialog 内部。
- 筛选器继续使用官方 Select/Tabs/Button/Toggle；不要以手写绝对定位菜单模拟 Select。
- 空状态继续用官方 Empty 组合；加载列表用 Skeleton，短时控件加载用 Spinner；错误状态以 Alert/Empty wrapper 提供 retry。
- 首页次级入口应改为 Card 组合或统一 Item，避免另一套手写圆角卡片语言。
- 正文标记、记录卡片、统计图属于领域组件，额外样式是必要的；但只使用主题 token，不引入独立品牌色、任意阴影或第二套圆角尺度。

## 4. 视觉一致性结论

- 当前暖纸色 token 和 Google Sans Flex 已形成比旧版更一致的视觉基础，应保留。
- 主要不一致来自“信息密度过稀”和页面功能被删后产生的空白，而非单纯色彩问题。先恢复信息结构，再做 spacing 微调。
- 成熟产品目标：同一 `max-w-6xl` 内容轴、统一 PageHeading、Card 边界、12/16/24/32 间距节奏、xs/sm/default 三档按钮、16px 功能图标、明确 hover/focus/disabled/loading/error。
- 响应式重点是：人物各分组宽表横向滚动、书面页桌面双栏/移动单栏、时间线图表可滚动、图片查看器占满可用视口、Sidebar 移动端关闭后焦点正确返回。

## 5. 本轮恢复后的复核结论

上面的对照表记录的是修改前差异，便于保留审计证据。本轮完成后，结论更新如下：

- P0 已完成：授权纪元缓存、session/IndexedDB/stale 回退、bfcache 复验、全站缓存清理、签名 URL 分级寿命和提前刷新、书面页消息/补录、搜索全量结果、非法标记原文降级均已恢复。
- P1 已完成：记录筛选与人物详情复用、书面双栏/跳页/相邻预载/隐藏书面、精确记录定位与返回对话框、人物三组独立排序和头像、Quiz 三级均匀抽样与隐藏逐字反馈、时间线年度/月度/每日/作者/人物/名言统计均已恢复。
- P2 已完成核心用户能力：共享签名资源 hook、图片失败重试、定时刷新、滚轮缩放、指针中心缩放、拖动边界、复位和地图复用；未复制或修改 shadcn 内部组件。
- P3 已完成：清除权限采用官方 AlertDialog 组合，Sidebar 保持官方结构，首页次级入口采用 shadcn Item，恢复页头全屏控制和背景主色提取/缓存，业务代码中不再存在原生 button/select/input 模拟组件或 legacy 路由分支。
- 实现方式不同但理念一致的项目继续保留：React Router SPA、类型化 AST、Context 数据共享、Recharts + shadcn Chart、签名 URL 直接加载，而不恢复旧版 DOM/innerHTML 和全套对象 URL 管线。

最终分类：Sidebar、授权、记录、人物、搜索、答题、时间线、地图、背景、全屏控制及加载/空/错状态均为 A 或 D。

## 6. 二次深度审查与补充修复

在首轮核心恢复完成后，又针对辅助页面、同页 URL 变化、浏览器历史记录、移动端导航和可访问性进行逐项复核：

| 复核项 | 发现的差异 | 最终处理 |
| --- | --- | --- |
| 记录筛选/视图 URL | 组件只在挂载时读取 query，同页链接和前进/后退可能保留旧状态 | 增加 URL → React state 同步，同时保留 state → URL 的 `replace` 更新和循环保护 |
| 时间线年月 URL | 浏览器历史恢复后年月状态可能与地址不一致 | 年/月重新以 URL 为外部事实源，并在无效值时归一到可用年月 |
| 搜索 query URL | 同组件存活时外部 query 变化不会更新输入框 | 增加 URL → 输入状态同步，120ms 防抖和全量结果保持不变 |
| 资料 id 直达 | `activeId` 只初始化一次 | 改为直接从当前 search params 派生，支持同页资料链接和浏览器历史 |
| 邀请码成功返回 | 提交回调与认证态重渲染都可能消费目标 | 成功只更新认证态，由唯一的 `<Navigate replace>` 消费目标 |
| 邀请码错误语义 | 错误使用通用 Alert，与官方表单示例的字段错误组合不一致 | 使用 `Field data-invalid`、`Input aria-invalid`、`FieldError role=alert` |
| 致谢空数据/动态标题 | 空数据生成空网格；数据库标题未更新浏览器标题 | 增加 shadcn Empty 状态，标题随数据更新 |
| 背景来源 | 摄影署名退化为不可点击文字 | 恢复作者/作品来源链接，使用安全新窗口属性 |
| 跨页面滚动 | React Router 不会像旧版独立文档那样自动回到顶部 | 路由 pathname 改变时重置滚动；保留记录定位自己的平滑滚动 |
| 移动端 Sidebar | SPA 导航后 Sheet 可能继续覆盖内容 | 通过官方 `useSidebar().setOpenMobile(false)` 在路由切换后关闭 |
| 键盘快速导航 | 缺少绕过全站 Sidebar 的入口 | 添加“跳到主要内容”链接和可聚焦内容目标 |
| 懒加载状态 | 路由 Suspense 只有文本 | 按 shadcn 模式组合 `Spinner` 与 `role=status` |

二次审查仍未修改 `frontend/src/components/ui`；Dialog/AlertDialog/Sidebar/Sheet/Empty/Field/Spinner 均通过公开 props、组合 API 和业务 wrapper 使用。业务源码中没有手写原生 button/select/input 来模拟 shadcn，也没有恢复任何 legacy HTML 路由兼容层。

## 7. 第三次专项 UI/体验对照（12 项）

| 专项 | 修改前差异与根因 | 当前处理 | 分类 |
| --- | --- | --- | --- |
| 左侧选择栏 | `isActive` 已传入，但默认 accent 与页面底色接近 | 继续使用官方 `SidebarMenuButton isActive`，仅以公开 `className` 将 active 映射到 `sidebar-primary/foreground`，并保持 hover 反色 | A |
| 超链接文字 | 正文引用使用 Button link 时叠加 padding、圆角和浅色填充，形成占位按钮感 | 保留 shadcn Button 的语义与焦点管理，改为行内、字体继承、无框、透明背景、点状下划线提示 | D |
| 记录条目框 | Card/Header/Content 默认纵向间距叠加，正文 `0.95rem` 且离分隔线偏远 | 记录 Card 使用紧凑 spacing，正文恢复 `1rem/1.85`，正文和附件分隔区分别收紧 | A |
| 背景显示/选择页 | 背景路径正确，但不透明 `SidebarInset` 覆盖根背景；预览比例与选中反馈偏弱 | 主内容改为 token 透明层；预览统一 16:9，选中 ring、`aria-pressed`、失败重试、署名和轻微预览反馈齐全 | A/D |
| 统计饼图 | 只有静态扇区和文字列表，缺联动、高亮、百分比和明确动画 | 依据 shadcn Chart 官方组合使用 `ChartContainer + ChartTooltip + Pie`；图例用 shadcn Button，支持 pointer/focus 双向高亮、百分比、总量中心和入场动画 | A/D |
| 答题页面 | 引用正文使用 muted 前景；隐藏题图只在当前题挂载后开始加载 | 正文提升到 `text-foreground/90` 与 `text-base`；题图使用稳定状态、Spinner、高优先级显示，并在题库解锁后有上限地预热 12 张低优先级图片 | A/D |
| 资料页面 | 只有目录有滚动限制，正文仍推动整页 | 页面建立固定可用高度，目录和正文各自使用官方 ScrollArea，移动端仍保留上下两块可滚动区域 | A |
| 插图标记 | HoverCard 为固定 fallback 尺寸，真实图解码后缺少受控比例和缓存 | pointer/focus/touch 先发起请求；4:3 占位后按真实尺寸更新并记忆，恢复 `360×280` 上限、视口边界、加载/错误/重试，定位交给 shadcn HoverCard 碰撞逻辑 | A/D |
| 大图显示 | shadcn Dialog 默认 `sm:max-w-*` 覆盖业务 max-width，桌面只出现窄框 | 业务 wrapper 通过公开 className 同时覆盖基础和 `sm:` 宽度上限，使用 `100vw/100svh - 1rem`，保留比例、缩放、拖动和复位 | A |
| 注释文本 | `record-markup` 的全局 foreground 覆盖 Tooltip 的反色前景 | 为注释内容增加限定 wrapper，继承 Tooltip 前景色并调整字号/行高；未改 Tooltip 源码 | A |
| 嵌套标记 | 删除线内的引用是 inline-flex 且 hover 改背景/装饰，造成父级删除线重绘闪烁 | 引用恢复纯 inline、无背景和稳定装饰厚度；AST 增加“删除线嵌套人物”回归用例 | A |
| 手写 Sticky | Card `overflow-hidden` 阻断 sticky，图片列也未设置 sticky | 业务 Card 覆盖为可见溢出，恢复 `42%/58%` 双栏，图片列 `top-20` sticky，图片高度限制到当前视口；移动端仍自然单列 | A/D |

专项修复只调整业务组件和主题层；`frontend/src/components/ui` 保持 CLI 原生文件零改动。视觉定制使用 token、variant、props、`className` 和业务 wrapper，未创建 shadcn fork。

## 8. 第四次专项差异审查与最终处理

| 专项 | 修改前差异 | 最终实现 | 分类 |
| --- | --- | --- | --- |
| 全站插图尺寸预取 | React 版只在首次 hover 后解码完整图片并写入组件内 Map，loading 框会从 4:3 变为真实比例 | 新增共享元数据服务：Range 读取 64 KiB，解析 PNG/JPEG/GIF/WebP/SVG，30/90 天访问范围缓存，四 worker 并发；入口扫描全部公开内容源 | A/D |
| Tooltip 尺寸一致 | HoverCard 可在尺寸未知时先打开，图片解码后修改 width/height | 使用受控 HoverCard；pointer/focus 先预热，真正打开前锁定一组尺寸，当前打开周期不再改变 frame | A |
| 手写页加载稳定 | 签名阶段展示通用 Skeleton，图片出现时整列高度变化 | 根据共享 intrinsic geometry 预留比例容器；默认沿用旧版 `2856×4282`，Spinner、错误文案和最终图片共用容器，相邻页继续预载 | A/D |
| 蹭饭图加载稳定 | 整张 Card 在数据和 URL 返回后才出现 | 尺寸元数据与短期 URL 分离缓存；使用官方 AspectRatio，默认 `4838×2721`，加载、重试和图片共用稳定区域 | A/D |
| 致谢入口层级 | 导览“继续探索”重复显示独立致谢 Item，底部入口只在正常文档流末尾 | 移除导览重复项；Sidebar 原入口保留；AppShell 右下角使用 shadcn Button 固定显示且当前页有明确状态 | A |
| Sidebar 接缝 | 已使用 SidebarRail，但默认 2px rail 在当前主题中反馈过弱 | 不改 rail 源码，只给官方 SidebarRail 增加 token 化 hover/active 过渡；MenuButton 继续使用官方 `isActive` | D |
| 背景层级与切换 | 根元素直接替换 background-image，主面板遮罩偏重，切换突兀 | 独立 fixed 背景层、渐变遮罩、透明内容表面和 500ms reduced-motion-safe 淡入；预览用官方 AspectRatio/Spinner | D |
| 全站排版 | body 缺统一行高/字距，PageHeading eyebrow 偏小，说明文字部分仅 14px | 统一 1.6 行高、轻微字距、balanced heading、pretty paragraph、selection token；页说明统一 16px/28px | A/D |
| Select/Dropdown | 记录筛选触发器宽度随文字变化，几个页面的排序下拉视觉密度不一致 | 直接使用 shadcn Select 组合，统一 128/144px 业务宽度、背景/hover/open ring、`align=start`，弹层动画继续由官方组件提供 | A/D |
| 状态过渡 | 部分筛选、资料切换、搜索结果、答题反馈直接替换 | 页面内容、记录筛选、资料、人物、名言、搜索、时间线、答题反馈和背景使用 150–500ms 克制过渡，并由全局 reduced-motion 规则关闭 | A/D |

shadcn 复核：本轮调用的 SidebarRail、SidebarMenuButton、Select、HoverCard、AspectRatio、Spinner、Button、Card、Collapsible、Tabs、Alert/Dialog 均来自 CLI 下载的原生组件。`frontend/src/components/ui` 与 `node_modules` 没有任何修改；尺寸解析、图片预载和 zoom/pan 属于档案领域逻辑，放在 `lib`、`services`、`features/archive` 与业务 wrapper 中。

## 9. 第五次专项差异审查：答题、资料、表格与切页性能

| 专项 | 修改前差异 | 最终实现 | 分类 |
| --- | --- | --- | --- |
| 答题筛选按钮颜色 | 题型选中态为 `default`，内容选中态为 `secondary`，同一筛选器出现两套颜色语义 | 两组均直接使用 shadcn Button 的 `default / outline` 状态；hover、pressed、focus 与 disabled 由同一组件契约提供 | A |
| `???` 题图尺寸门 | 只预热前 12 张完整图片；当前题仍以固定 `h-56` loading 框开始，解码后换成真实高度 | 管理员解锁题库后，先为全部题图并发读取尺寸，再开放隐藏题池；题图使用一次挂载周期内锁定的 intrinsic ratio，Spinner、错误、重试与最终图片共用容器 | A/D |
| 切题阅读位置 | 新题内容高度变化时依赖浏览器自然回流，页面接近底部时题干会移动 | 切换前记录题干上方视口坐标，React layout 阶段按差值补偿滚动；题目内容同时保留稳定最小高度 | A/D |
| 页面标题节奏 | PageHeading 的底部分隔、外边距和说明段间距叠加偏大 | 统一收紧为 24px 外间距、20px 底部 padding、8px 标题说明间距，保留清晰标题层级 | A/D |
| 资料双区滚动 | 内部虽有两个 ScrollArea，但 AppShell 与资料网格高度叠加后仍可能产生 body 纵向滚动 | `/materials` 使用 `100svh - 4rem` 的固定主区；页面为 `flex` 高度链，目录和正文占用剩余空间并各自滚动，外层 `overflow-hidden` | A |
| 标记表格 | AST 正确，但渲染仍维护原生 `<table>/<tbody>/<tr>/<td>` 组件树 | 直接组合 shadcn `Table / TableBody / TableRow / TableCell`，领域 CSS 只负责宽度估算、边框与内容排版 | A |
| 页面切换速度 | 已有 route lazy，但只有点击后才开始取 chunk；全局图片元数据组件还会主动触发整套 Archive 加载 | 集中复用动态 import loader，并在 Sidebar pointer/focus 意图时预取；元数据组件改用无副作用 snapshot，只在档案数据已被页面需要后延迟预热 | D/A |

专项回归已加入 `test-quiz-core`、`test-record-markup`、`test-static-site` 和 `test-illustration-preload`。生产构建确认各业务页保持独立 chunk；本轮仍未修改 `frontend/src/components/ui`。

## 10. 第六次终审：答题生成与提交后呈现

前五轮已经恢复了答题数据源、三级等权筛选、隐藏题图尺寸门和页面稳定性，但终审逐函数对照 `b0923d4:js/quizApp.js` 后确认，React 题目模型仍把若干旧版行为简化成了通用问答。此次将差异收敛如下：

| 专项 | 终审发现 | 最终实现 | 分类 |
| --- | --- | --- | --- |
| 人物选择干扰项 | 仅使用人物主名称，丢失旧版“同人物别名/其他人物别名”的四项构造策略 | 重新汇总人物 ID、姓名、单别名、别名数组及正文实际标记文字；按旧版三种候选组合生成四个规范化唯一选项 | A |
| 记录人填空 | React 版要求完整姓名，旧版要求姓名拼音首字母 | 恢复旧版题干与小写答案；比较仍执行正文标记剥离、NFC、trim 与大小写归一 | A |
| 日期干扰项 | 从全部日期无差别随机 | 恢复按日期距离排序、从较远候选窗口抽取三个干扰项 | A |
| 人物/名言挖空 | 生成时直接把所有目标替换成下划线，提交后无法原位揭示 | 保留原文和命中答案；题目阶段只隐藏命中位置，提交后在同一位置显示答案 | A/D |
| 判断题 | React 版把判断内容压缩成题干一句话，提交后只在 Alert 给说明 | 恢复记录正文随机正确/错误；人物可多位置替换，名言替换一个命中，记录人使用独立侧栏；提交后原位删除错误词并紧邻显示正确词 | A |
| 隐藏答案字符 | 使用 `Array.from` 且删除全部空白；累积方框填满即可通过 | 恢复 NFC + trim 语义，优先用 `Intl.Segmenter` 按 grapheme 切分；方框保留历次正确位置，但仍要求某一次完整输入全部正确 | A |
| 筛选重置 | 缺少旧版“全选可用”入口 | 使用 shadcn Button 恢复入口；题型与内容仍使用统一 `default / outline` 状态和不可取消最后可生成组合的约束 | A |
| 无题状态 | 误用网络错误状态，提示用户检查连接 | 改为 shadcn Empty 语义，明确提示调整题型或内容筛选 | D |
| 题型颜色 | 题卡始终使用统一 primary，未满足按题型区分 | 通过业务层 `data-question-type` 和低饱和 OKLCH 变量为选择/填空/判断提供蓝、琥珀、青绿三组表面；只作用于 Card 头部、左侧题干线、Badge 和选项标记 | D |
| 答案状态 | 正确项使用普通 primary，错误项使用 destructive，正确语义不够明确 | 保留 shadcn Button 外壳，以低饱和绿/红业务状态覆盖已禁用选项；A–D 与 ✓/× 标记、正确项、用户错选项均同时可见 | A/D |

终审验证：TypeScript、Biome、11 组回归测试和 Vite 8 生产构建通过；桌面 `1280px` 与移动 `390×844` 视觉检查确认筛选换行、题干可读性、四项按钮、反馈区和三种题型色无溢出。门禁生产页无控制台错误。`frontend/src/components/ui` 在本轮仍为零修改。

## 11. 第七次终审：生命周期、恢复语义与错误上限

此前文档把全屏、精确记录定位和图片失败恢复归为 A/D，但逐事件流复核后确认仍有细粒度缺口。本轮以实际代码修改收敛如下：

| 专项 | 终审发现 | 最终实现 | 分类 |
| --- | --- | --- | --- |
| 公共 404 | 未授权未知路径先进入门禁，成功后才看到 404，并错误消耗一次邀请码 | 顶层先区分已知受保护路径与未知路径；404 不挂载 Archive 数据，按认证态返回验证页或导览页 | A/D |
| 首屏背景 | 背景只在受保护应用挂载后恢复，认证与懒加载阶段会短暂回到默认表面 | 新增同源外部 `theme-bootstrap.js`，React 启动前恢复背景预载与 palette 快照；`BackgroundRoot` 统一覆盖认证、404 和业务页 | A/D |
| 全屏偏好 | 只有页头开关，没有 `sessionStorage` 保留及首次手势恢复 | 恢复 `classRecord:keepFullscreen`、`pagehide` 保留、`fullscreenchange` 同步和首次 pointer 恢复；明确退出仍清除 | A |
| 导览 bfcache | React 路由只在 pathname 挂载时回顶 | 导览页恢复 `history.scrollRestoration = manual` 与 `pageshow` 回顶 | A |
| 邀请码提交 | 按钮禁用但输入仍可编辑；已有凭证复验错误缺少可操作说明 | 输入与主按钮均锁定，移动端点击区提高到 44px；字段错误同时覆盖复验异常与新邀请码重试 | A/D |
| 人物边界 | `aliases` 数组未回退显示；无 authored 记录仍展示空切换页；同页换人保留旧筛选 | 恢复别名回退、按人物 id 复位局部状态、无 authored 时隐藏切换器；名单全空显示 Empty | A |
| 名言来源与空态 | 来源文件失效时仍生成死链接；空集合显示空白网格；排序图标缺少可见语义 | 点击前按旧版 direct/fallback 规则校验来源，以 shadcn Alert 反馈 0/多来源；增加 Empty；排序显示“升序/降序”文字 | A/D |
| 记录内部引用 | 所有引用强制进入列表，不能恢复书面页、筛选与滚动；`.json`/特殊字符锚点可能失配 | 业务回调协调同页跳转，保存并恢复 view/pageIndex/criteria/scrollY；目标无书面页时明确降级列表；统一 `recordAnchor` | A/D |
| 图片解码失败 | 地图、手写页和大图查看器的 `onError` 会持续强制重签，缺失对象可形成无界请求 | 新建共享有界重试 Hook：自动刷新一次，耗尽后稳定错误态，用户可显式重试；三处图片入口统一使用 | A |
| 部分公共数据失败 | Archive `Promise.all` 令任一数据源失败时全部页面丢失已有数据 | 改为 `Promise.allSettled` 和派生名言独立错误收集；保留成功 records/people/quotes 并同时显示可重试错误 | A/D |
| 资料边界 | 空资料渲染两块空 Card；非法 id 静默回退 | 空集合使用 shadcn Empty；非法 id 明确说明已回退第一项 | A |

本轮仍只使用 shadcn 的公开组合 API 和业务 `className`；`frontend/src/components/ui` 未改动。新增/更新回归契约覆盖有界图片重试、内部记录跳转原状态、锚点规范化、认证锁定、首屏主题与全屏会话。

## 12. 第八次逐细节复核：答题几何与时间线层级

| 专项 | 重新对照旧源码后的差异 | 本轮最终实现 | 验证 |
| --- | --- | --- | --- |
| 填空占位几何 | React 未揭示状态没有渲染答案字形，只依赖 `em` 最小宽；可变宽 Latin/数字答案揭示时仍可能扩宽，且 revealed 额外加粗 | 答案字形始终挂载并透明显示；揭示只改变颜色/背景，不改变文字、字号、字重、padding 或下划线长度 | 静态契约 + 生产 CSS 浏览器尺寸比较 |
| 题型头部对齐 | shadcn Card 默认 `py` 使题型色面与大卡片上边缘之间保留一段未着色空隙 | 业务 Card 使用 `gap-0 py-0`，Header 自己承担上内边距，色面、边框与圆角直接衔接外框；未改 Card 基础组件 | DOM 几何比较 |
| 隐藏题筛选 | 解锁成功后 React 自动把 `secret` 加进 active contents，旧版只显示未选中的 `???` 入口 | 解锁只加载并暴露入口，是否纳入题池由用户明确选择 | 静态契约 |
| 等权抽样 | React 为避免连续重复先排除上一题，导致只有一个变体的来源下一轮权重归零 | 恢复旧版来源→内容→题型三级等权，并允许随机结果自然重复；随机源可注入以运行确定性测试 | Vite SSR 执行 300 次等权测试 |
| 时间线全局/年度层 | React 只有所选年度月柱图和所选月饼图，缺少整体作者饼图、全档案逐月趋势及年度作者饼图 | 恢复整体、年度、月度三层记录人分布，并增加跨年份、按年月排序的完整趋势图 | 静态契约、类型检查、构建 |
| 固定刻度 | React 使用粗略固定 domain；旧版按月 100/25 或 3000/750、按日 12/3 或 1000/250，超限后向上取整 | 抽取纯 `fixedTimelineChartScale`，显式输出 domain 与 ticks；超限仍完整显示 | 纯函数运行测试覆盖 88→100、126→150 |
| 每日作者构成 | React 日历按钮只有日期，丢失旧版每日作者小饼图、重要量和图例联动 | 恢复每日作者小饼、稳定作者颜色、重要条/字数及 pointer/focus 图例强调 | 类型检查、静态契约；真实数据待登录态复核 |
| 空月与名言下钻 | 空月份 URL 被自动改到有数据月份；名言排行先进入名言页而非唯一来源记录 | 合法空月深链保留稳定 0 数据结构；时间线复用共享 quote source resolver，唯一来源直接进入记录，异常用 shadcn Alert | URL/来源契约；真实数据待登录态复核 |

完整的逐功能 20 字段状态已经独立整理到 `baseline-b0923d4-maintenance-matrix.md`，避免本审计文件继续依赖零散轮次描述。
