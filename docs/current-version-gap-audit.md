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
