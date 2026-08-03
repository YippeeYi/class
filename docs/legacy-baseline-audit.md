# 旧版本功能基线与现行版本整改审计

基准提交：`b0923d471abbf85f0bf88fbb635cefbbbb041e37`  
现行提交：`7caec44`（审计开始时）  
审计日期：2026-08-03  
现行架构：React 19、TypeScript、Vite 8、Tailwind CSS 4、shadcn/ui（Base UI）、React Router 7、Supabase JS 2。

> 本文是本轮整改的统一验收入口。旧版跨模块细节继续以
> [`baseline-b0923d4-functional-spec.md`](./baseline-b0923d4-functional-spec.md) 为展开说明，
> 22 个功能域的长期维护字段见
> [`baseline-b0923d4-maintenance-matrix.md`](./baseline-b0923d4-maintenance-matrix.md)。
> 本文重新以实际源码和运行结果复核状态，不继承既有文档中未经本轮验证的“已完成”结论。

## 1. 审计方法与证据边界

- 使用 `git show`、`git ls-tree` 和逐文件阅读核对旧版 14 个 HTML 入口、31 个脚本、`style.css`、SQL、管理脚本和自动化契约。
- 逐页读取现行路由、页面组件、业务组件、数据服务、缓存、认证、图片签名、主题和样式实现。
- 审计开始时执行 `npm run check`：TypeScript、Biome 和 11 组自动化契约通过；沙箱内构建因原生 Vite/Tailwind 进程 `spawn EPERM` 被阻止，沙箱外 `npm run build` 通过。
- 通过只读 Supabase 检查核对蹭饭图：`class_private_assets` 存在 `meal-map` 元数据（4838×2721）；bucket 为 `classrecord-private`；对象精确路径为 `images/private/meal-map.png`；对象存在且 MIME 为 `image/png`。
- 未使用或提交私有图片；未在日志、文档、URL 或代码中输出 service-role key、邀请码或访问令牌。
- 登录态真实数据验收需要有效、未撤销的浏览器访问令牌。未获得该令牌的检查必须明确标为“待登录态复核”，不得以静态检查冒充完成。

## 2. 页面清单、入口与跳转

| 旧版页面 | 现行路由 | 入口 | 主要出口/深链 | 基线职责 |
| --- | --- | --- | --- | --- |
| `auth.html` | `/auth` | 受保护路由重定向 | 成功返回原 pathname/query/hash | 一次性邀请码、复验、错误与提交锁定 |
| `index.html` | `/` | 验证成功、全站导航 | 全部业务页 | 统计、主入口、次入口、提示、历史上的今天、清除权限 |
| `record.html` | `/records` | 导览、人物、名言、搜索、时间线、正文引用 | 人物、资料、附件、大图 | 普通/书面双视图、筛选、隐藏、精确定位 |
| `people.html` | `/people` | 导览、侧栏 | `/person?id=...` | 学生/教师/其他三组、独立排序、统计 |
| `person.html` | `/person?id=...` | 人物表、正文人物标记、时间线 | 精确记录、返回名单 | 资料、头像、参与/记录切换、记录筛选 |
| `quotes.html` | `/quotes` | 导览、搜索、时间线 | 唯一来源记录 | 名言派生、排序、来源校验 |
| `timeline.html` | `/timeline` | 导览 | 年/月/日、人物、名言、记录 | 条数/字数、多层统计、图表与下钻 |
| `search.html` | `/search?q=...` | 导览 | 人物、名言来源、记录 | 全量索引、120ms 防抖、分组、高亮、URL 同步 |
| `quiz.html` | `/quiz` | 导览、侧栏 | 无 | 选择/填空/判断、筛选、等权抽样、判题、隐藏题 |
| `materials.html` | `/materials?id=...` | 导览、`material` 标记 | 其他资料、人物/记录/插图 | 目录、直达、正文、双区滚动 |
| `map.html` | `/map` | 导览、侧栏 | 大图查看器 | 私有地图、短签名、重试、缩放、拖动 |
| `shop.html` | `/backgrounds` | 导览、侧栏 | 全站主题状态 | 背景预览、选择、署名、动态 palette、持久化 |
| `credits.html` | `/credits` | 全局导航 | 标记链接 | 制作、致谢、附件、动态标题 |
| `404.html` | `/404` 与未知路由 | 未知地址 | 验证页或导览 | 公开错误边界，不提前消费邀请码 |

现行 React Router 是旧版多文档导航的等价架构，不回退。必须保留 URL 深链、浏览器前进/后退、进入页回顶、移动 Sidebar 自动关闭和路由级懒加载。

## 3. 逐页功能、操作与状态基线

| 页面/模块 | 必须保留的功能与操作 | 必须保留的状态 |
| --- | --- | --- |
| 门禁 | 邀请码验证、返回原地址、移除访问、服务端复验 | idle、validating、authenticated、invalid、revoked、expired、configuration error |
| 导览 | 统计、入口、提示轮换、历史上的今天、Logo 彩蛋 | 数据加载、部分失败、无当日记录、弹窗开闭 |
| 记录 | list/written、年/月/日、重要、排除例行、关键词、清除、隐藏键序列、附件、精确跳转与恢复 | 筛选 URL、页码、滚动上下文、目标高亮、hidden 仅内存、图片加载/错/重试 |
| 人物 | 三组同时存在、各自排序、教师学科顺序、主要教师置顶、人物详情、头像、参与/记录切换 | 每组排序独立、同页换人复位、无记录/无头像/人物不存在 |
| 名言 | ID/内容排序与升降序、唯一来源解析 | 空集合、0/多来源错误、来源可达 |
| 搜索 | URL 初值、120ms 防抖、类型筛选、全量结果、评分、摘要与高亮 | 索引未就绪、初始空、零命中、部分数据失败 |
| 答题 | 选择/填空/判断、题型/内容筛选、全选可用、来源→内容→题型等权、作答、下一题、`lamian` 管理题 | 题库加载、无可生成组合、答题中、正确、错误、隐藏题解锁/加载/字符进度/图片错误 |
| 时间线 | 条数/字数、全局/年度/月度/每日、作者饼图、日历、排行、人物/名言/记录下钻 | 合法空月、无日期、图例 hover/focus、高亮、来源错误 |
| 资料 | sort_order 目录、`id` 直达、历史恢复、正文标记、插图预热 | 加载、空、非法 id 回退、左/右独立滚动 |
| 蹭饭图 | 元数据、固定私有路径、立即签名、缩略图、大图、缩放、拖动、复位、重试 | 稳定比例 loading/ready/error、一次自动重签、手动重试、签名定时刷新 |
| 背景 | 纸本/山/云、真实预览、摄影署名、选择、跨页持久化、首屏 bootstrap、动态取色 | eager/lazy、加载、错误、重试、selected、pressed、focus、reduced motion |
| 致谢 | 动态标题、章节、感谢、附件、标记渲染 | loading、empty、error、content |
| 404 | 未知路由公开显示、按认证态返回 | 不挂载档案数据、不消费邀请码 |

## 4. 数据、状态、缓存与生命周期

| 数据/状态 | 来源 | 现行管理方式 | 缓存与失效 | 安全/生命周期要求 |
| --- | --- | --- | --- | --- |
| 访问权限 | `verify_invite_code`、`refresh_invite_access` | `AuthProvider`、每 token Supabase client | localStorage 保存 token 元组；服务端窗口复验 | 90 天滑动、365 天绝对；bfcache 复验；清权时全缓存擦除 |
| records/people/pages/messages/supplements/materials/credits | Supabase 表 | `services/data.ts`、`ArchiveProvider`、`useAsyncData` | memory→session→IndexedDB；授权纪元隔离；fresh/stale 窗口 | 并发合并；部分成功可用；hidden 不持久化 |
| quotes/stats/search/quiz | 上述数据派生 | 纯函数、memo、类型化领域模型 | 跟随源数据生命周期 | 不重复请求；规则只在一处定义 |
| 私有图片 | `classrecord-private` Storage | `signAssetUrl`、`useSignedAsset`、业务 viewer | 签名 URL 仅内存；普通 600 秒、敏感 180 秒、80% 提前刷新 | RLS SELECT；不得持久化 URL；卸载/清权后失效 |
| 图片固有尺寸 | 表元数据或 Range 64 KiB | `services/image-metadata.ts` | 30 天 fresh、90 天 stale、授权隔离 | loading/ready/error 共用同一几何占位 |
| 背景 | 本地图片与 `classRecord:background` | `BackgroundRoot` + 启动脚本 | ID 和 palette 本地缓存 | 切页不闪白；深浅图片上正文对比稳定 |
| 筛选/深链 | query/hash | React state 与 URL 双向同步 | 浏览器 history | 同页链接和前进/后退必须恢复；不得形成 effect 循环 |
| 全屏 | Fullscreen API | `AppShell` | sessionStorage | 用户手势恢复；明确退出清除偏好 |

### 蹭饭图后端核对结果

- 数据库记录存在，`asset_key` 为 `meal-map`，宽高为 4838×2721。
- bucket 名为 `classrecord-private`，对象精确路径为 `images/private/meal-map.png`，大小写一致。
- 对象 MIME 为 `image/png`，大小约 2.36 MB；上传时间与元数据更新时间相邻。
- SQL 约定只允许固定地图路径，Storage policy 要求 `has_class_record_access()`；未改为公开 bucket，也没有硬编码永久 URL。
- 因此本轮故障根因不是对象缺失、错误路径、错误 MIME 或数据库缺行，而是现行页面同时发起 `loadMealMap()` 与 `useSignedAsset()` 两条签名/加载链路，元数据、URL、图片解码和重试错误被组合成一个布尔状态；在初始化、强制刷新或请求先后顺序变化时会出现竞态和不明确的失败判定。整改应收敛为“元数据与签名并行但职责唯一、URL 单一所有者、图片状态单一 reducer/Hook”。

## 5. 交互细节清单

- 所有可点击卡片/行必须具备原生链接或按钮语义，支持 Enter/Space；focus-visible 不能依赖 hover。
- 路由意图在 pointer enter/focus 时预取；内部导航保留克制淡入并尊重 reduced motion。
- Sidebar 当前页必须有明确 active 状态；移动端完成导航后关闭 Sheet 并归还焦点。
- 正文注释支持 hover/focus/touch；插图先锁定 frame，再展示缩略图；滚动/离开时关闭。
- 大图查看器以指针为中心滚轮缩放，支持拖动、fit、复位和边界约束；浏览器页面不参与缩放滚动。
- 记录内部引用保存 view/page/filter/scroll，目标高亮后允许留在目标或恢复原上下文。
- 答题筛选中不可取消最后一个可生成组合；作答后选项禁用但正确/错误状态仍清晰。
- 填空答案字形在隐藏状态常驻且透明；揭示只改变颜色/背景，不改变宽度、字重、padding 或下划线。
- 背景选择应使用 Radio Group/整卡 Choice Card 语义；整张预览可点，方向键可切换，当前项有 checked 状态。
- 图片失败只允许一次自动强制重签，之后稳定显示错误；用户手动重试重置预算，不得形成请求循环。
- 资料目录和正文、答题正文、地图 viewer 分别处理内部滚动；外层视口在用户指定的三页不得滚动。

## 6. 视觉与布局基线

- 全站内容轴使用一致的宽度和页面内边距；功能型宽屏内容可扩大到 1280–1440px，长正文阅读行宽保持约 60–75 个中文字符。
- 页面标题、说明和右侧动作在同一工具栏层级；不得同时出现全局品牌标题、重复小标题和额外大段留白。
- 正文不少于 16px；资料正文建议 17–18px、1.85–1.95 行高；辅助文字不得小于可辨认的 13–14px。
- 使用 4/8/12/16/20/24/32 间距节奏；功能图标统一 16–20px；数字使用 tabular figures。
- 外层 Card 只用于确有独立边界的内容；目录+正文、题型头+题体属于一个连续工作区，避免重复边框、圆角和阴影。
- 背景必须透出但不降低正文对比度。内容表面可透明/模糊，不能完全不透明遮住背景，也不能只提高原图亮度或饱和度。
- hover 以边框、色面和阴影轻微变化为主；禁止背景卡片突兀上浮。pressed 使用轻微缩放/下压；selected 不依赖动画表达。
- loading、error、ready 必须共享关键容器尺寸；Tooltip、Popover、Dialog 使用碰撞边界，不能造成 root overflow。
- 资料、答题、蹭饭图页面使用 `100dvh/100svh` 可用高度计算并锁定 root；任何滚动只发生在明确的内部区域。

## 7. 新旧/新要求差异表（整改前）

| 页面/模块 | 旧版本/目标行为 | 当前版本行为 | 是否一致 | 差异原因 | 修复方案 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| 全局致谢入口 | 入口统一且不遮挡内容；本轮要求移出右下固定层 | Sidebar 已有“致谢”，同时所有页仍固定悬浮“制作与致谢” | 否 | 既有文档把旧版固定入口误判为本轮目标 | 删除固定 footer；保留 Sidebar，并在窄屏“更多/菜单”内同源呈现 | 全路由 DOM 无 fixed credits；Sidebar 可达 |
| AppShell 高度 | 资料/答题/地图外层均锁定视口 | 仅资料页使用固定高度；答题/地图仍为文档流 | 否 | 页面类型只判断 `/materials` | 引入 `viewportLockedPaths`，统一 `h-[calc(100dvh-4rem)] min-h-0 overflow-hidden` | 1920、1440、1366、390 宽度检查 root scrollHeight |
| 页面标题 | 标题/说明/动作进入紧凑工具栏，释放工作区 | 每页重复 eyebrow、大标题和说明；地图还另有 Alert | 部分 | PageHeading 只有展示型规格 | 为工作区页面增加 compact 模式；操作区保持可见 | 标题无重复，工具栏高度稳定，窄屏操作不越界 |
| 背景选择 | 整卡可选、预览清晰、checked/键盘语义 | Card + 独立按钮；非图片“纸本”预览为空；hover 上移 | 否 | 以展示卡片而非选择控件建模 | RadioGroup + label choice card；真实纸本预览；去掉位移；整卡选中 | Tab/方向键/点击整卡；checked 与 localStorage 同步 |
| 背景切换 | 已选背景预解码后平滑替换，无闪白 | keyed fixed layer 立即更换；新图未解码时可短暂只见遮罩 | 部分 | preview 与根背景加载生命周期分离 | 统一图片预热状态；就绪再提交视觉层；保留旧层交叉淡出 | 慢网模拟、切三背景、记录布局/闪烁 |
| 背景可见性 | 背景可感知，正文稳定可读 | `SidebarInset bg-background/78` 仍遮挡较重；Card 多为高不透明 | 部分 | 透明层级不一致 | 工作区表面统一 token 化透明度，减少额外 Card | 山/云/纸本下对比度与背景可辨性截图 |
| 资料布局 | 大内容区；目录/正文独立滚动；外层无滚动 | 双 Card、双 Header、`max-w-6xl` 和较大外层 padding 压缩正文 | 部分 | 迁移时机械卡片化 | 合并为一个分栏工作区；目录分隔线代替外卡；扩大 max-width；正文排版单独优化 | 目录/正文 scrollTop 独立；root 不滚；长文行宽测量 |
| 资料正文 | 标题、段落、引用、表格、插图适合长读 | 通用 `record-markup` 为 16px；内容 Card padding 后有效宽度偏小 | 部分 | 记录正文样式直接复用 | 增加 material article 业务类，17px/1.9、合理阅读宽度与标题间距 | 1440/1366/390 长文视觉检查 |
| 蹭饭图加载 | 进入即单一链路稳定显示；缓存命中无 loader | `loadMealMap()` 和 `useSignedAsset()` 同时拥有 URL，错误状态混合 | 否 | 数据与资源职责重复 | `loadMealMapMetadata` 只管元数据；`useSignedAsset` 唯一拥有 URL；显式状态机与有界重试 | 缓存命中、冷启动、404、过期、手动重试契约 |
| 蹭饭图布局 | 无横纵滚动；图片在剩余区域完整 contain | PageHeading + Alert + Card 会超出 768px 高度，外层允许滚动 | 否 | 未采用 viewport workspace | 紧凑工具栏+内联隐私提示+无外 Card 的稳定 figure；剩余高度 grid | 四视口 `scrollWidth/Height` 与自然比例 |
| 答题外层 | 视口不滚，筛选/题目内部滚动，换题不带走外层 | 常规页面流；筛选 Card + `min-h-[30rem]` 使 768px 必滚 | 否 | 沿用内容页容器 | 固定高度三段 grid；筛选改紧凑工具条；题卡 flex；题体独立 ScrollArea；动作区固定 | 外层 scrollTop 恒 0；题体可滚；下一题按钮可见 |
| 答题题型头 | 色块与主容器同边、同宽、同圆角 | Header 在 Card 内，但左色条仅 header，自身 `rounded-t-xl` 与 Card 圆角可能重复 | 部分 | Card/Header 样式重复负责边界 | 由 Card 统一裁切圆角；Header 不再自带独立圆角；题型色面铺满顶边 | DOM 几何、边框/圆角截图 |
| 答题反馈 | 答案出现不推动关键操作，填空几何不变 | 填空几何已基本稳定；Alert/下一题仍插入题体末尾并推动内容 | 部分 | 反馈区条件挂载 | 预留固定反馈/操作区或将其放进 sticky footer | 作答前后题干与底部动作坐标比较 |
| 全站密度 | 提高有效内容面积、减少空白和重复卡片 | PageHeading + Card Header/Content 默认间距多次叠加 | 部分 | 组件默认间距未按业务场景收敛 | 工作区页面用分隔线/色面；保留数据展示 Card；统一 compact 间距 | 页面逐项截图、有效内容面积对比 |
| Shadcn 源码 | 只读，通过组合与 className 扩展 | 目录当前无工作区改动 | 是 | — | 继续保持；新增业务 wrapper 放在 `components/archive/layout` 或页面层 | `git diff -- frontend/src/components/ui` 为空 |
| 安全与隐私 | 私有资源仅短签名，不进 Git/持久缓存 | 后端对象、路径、MIME 均正确；签名 URL 仅内存 | 是/待登录态 | 真实普通 token 未在本轮可用 | 不改变 bucket/RLS；补登录态签名验证说明 | 静态契约 + 正常/失效 token 在线测试 |
| 构建与契约 | TS、Lint、测试、生产构建均通过 | 整改前均通过（构建需沙箱外） | 是 | 沙箱原生进程限制非代码问题 | 每阶段复跑，新增布局/状态契约 | `npm run check`、沙箱外 build |

## 8. 整改顺序与完成判定

1. 先修 AppShell 的全局高度、致谢入口和页面工作区契约。
2. 重构背景选择与背景层切换状态，保持本地 ID/palette 行为。
3. 重构资料工作区和长文排版，不改变 `id`/标记/插图数据行为。
4. 收敛蹭饭图元数据与签名链路，修复状态机和无滚布局。
5. 重构答题工作区、内部滚动、头部衔接和稳定反馈，不改变 quiz engine 业务规则。
6. 复核其余页面的字号、空白、Card 使用、hover/focus/disabled/loading/error；只做能由差异证据支持的改动。
7. 运行类型、Biome、完整契约、生产构建；在可用的登录状态下执行逐页和多视口浏览器验收。

完成状态只允许：

- **已完全一致**：行为、状态和用户可见结果与基线一致。
- **已采用等价实现**：现行架构不同，但可观察行为与安全边界等价。
- **暂时无法一致**：必须写明原因、影响、替代方案和后续步骤。

## 9. 最终整改状态

| 页面/模块 | 最终状态 | 现行架构下的实现 | 结果 |
| --- | --- | --- | --- |
| 全局致谢入口 | 已完全一致 | 删除右下固定入口，仅保留 Sidebar 及移动菜单中的同源 `/credits` 入口 | 不再遮挡正文，入口仍始终可达 |
| 视口工作区 | 已采用等价实现 | `AppShell` 统一识别 `/materials`、`/quiz`、`/map`，锁定 `html/body/SidebarInset/page-content` | 五档视口均无外层横纵滚动 |
| 背景选择 | 已采用等价实现 | shadcn `RadioGroup` + 整卡 `label`；纸本也有真实预览；去除 hover 位移 | 点击整卡、Tab/方向键、checked 与持久化均正常 |
| 背景根层 | 已采用等价实现 | 新图预解码后再提交可见层，旧层保留 560ms 交叉淡出；palette 跟随已显示层 | 切换不闪白，背景辨识度提高，正文表面仍可读 |
| 资料页 | 已采用等价实现 | 单一分栏工作区替代双 Card；目录和正文分别使用 `ScrollArea`；正文采用 17–18px、1.92 行高 | 内容区扩大，长文层级清晰，两个滚动区互不干扰 |
| 蹭饭图加载 | 已完全一致 | `loadMealMapMetadata` 只负责尺寸，`useSignedAsset` 是唯一 URL 所有者；移除额外 Range 探测和竞争 URL | 真实 PNG 在五档视口解码为 4838×2721；冷启动/重签/重试职责单一 |
| 签名资源竞态 | 已采用等价实现 | Hook 以 `path` 作为状态身份，并用 revision 丢弃过期响应；强制刷新失败时可暂留同路径旧 URL | 路径切换不会短暂暴露上一张资源，异步回写不再串图 |
| 蹭饭图布局 | 已完全一致 | 紧凑页头 + 单一剩余高度 `figure`，图片始终 `object-contain`，大图交互复用 `ImageViewer` | 无页面滚动、无裁切；缩放、拖动、复位入口保留 |
| 答题页 | 已采用等价实现 | 紧凑筛选工具条、单一题卡、题体内部 `ScrollArea`、常驻反馈/动作 footer | 外层不滚；题型头与题卡齐边；作答反馈不再推走“下一题” |
| 标题、密度与背景透出 | 已采用等价实现 | 工作区使用 compact `PageHeading`；减少机械 Card 套娃和多层不透明表面 | 有效内容面积增加，视觉层级收敛 |
| Shadcn 边界 | 已完全一致 | 仅组合公开组件及业务 `className`，没有修改基础组件源码 | `git diff -- frontend/src/components/ui` 为空 |

## 10. 最终验证记录

- `npm run typecheck`：通过。
- `npm run lint`：Biome 检查 52 个前端文件，通过。
- `npm test`：11 组安全、缓存、图片、正文、答题、搜索和静态契约全部通过。
- `npm run build`：TypeScript + Vite 8 生产构建通过，共转换 2815 个模块。
- 多视口受控浏览器回归：`1920×1080`、`1440×900`、`1366×768`、`900×600`、`390×844`；资料、答题、蹭饭图三页的 `scrollWidth/scrollHeight` 均等于视口，操作按钮无越界，固定致谢入口不存在。
- 资料页每档视口恰有两个内部滚动区；答题页恰有一个题体滚动区；蹭饭图无内部滚动区，viewer frame 完整占用剩余高度。
- 蹭饭图后端只读核验：`class_private_assets.asset_key = meal-map`，尺寸 `4838×2721`；bucket 为 `classrecord-private`；对象路径、大小写和 MIME `image/png` 正确；签名读取 HTTP 200，PNG 签名及字节均有效。
- 浏览器使用真实私有 PNG 字节完成五档视口解码，`naturalWidth = 4838`、`naturalHeight = 2721`、`complete = true`；页面控制台在最终单页复核中零错误、零 Base UI 语义警告。
- 背景交互回归：点击整卡从纸本切到山，方向键再切到云；全程只有一个 `data-checked` 项，控制台零错误。
- 公共门禁页在 `1366×768` 与 `390×844` 下完成视觉复核：无横纵溢出，表单和 44px 主操作保持可见。
- 12 个受保护路由在 `1366×768` 下完成页面/合法空态 smoke test；一次 Vite `Outdated Optimize Dep` 由重启临时 dev server 后消失，受影响的记录、人物、人物详情、名言、时间线五个懒加载页复测均为零控制台错误、零请求失败、零横向溢出。
- 未修改 SQL、RLS、Storage policy 或任何私有对象；未将 service-role、邀请码、access token、签名 URL 或私有图片写入 Git。

## 11. 仍需区分的验收边界

本轮没有可用的普通最终用户邀请码/access token。受保护页回归使用本地假访问记录跳过门禁刷新，并在测试进程内以 service-role 只读代理真实 Supabase 响应；它验证了真实数据、签名后的前端状态机、图片解码和布局，但不能替代“普通 token → RPC 复验 → RLS → createSignedUrl”的完整 A 类链路。无数据库或 Storage 整改待办；若要关闭最后这一个授权链路验收项，只需使用一个有效普通邀请码登录后打开 `/map`，确认图片直接出现并可打开大图。失效/伪造 token 的拒绝边界已由 `verify-live-security.mjs` 在线通过。
