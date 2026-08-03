# `b0923d4` 旧版功能基线维护矩阵

唯一基准：`b0923d471abbf85f0bf88fbb635cefbbbb041e37`。

本矩阵用于持续审计。每个功能项均拆成用户要求的 20 个字段；“当前状态”和“验证”必须在后续改动时同步更新，不能用计划替代结果。

验证代码：

- `T`：TypeScript、Biome、自动化契约及纯函数运行测试通过。
- `B`：Vite 生产构建通过。
- `P`：无需登录的真实浏览器路径通过。
- `A`：需要有效邀请码和真实 Supabase 数据的登录态浏览器复核；未执行时必须标为“待 A”。
- `R`：受控只读浏览器回归，使用真实 Supabase 数据但在测试层绕过普通邀请码/RLS；可验证页面与数据，不替代 A。

## A. 字段 1–10：功能、实现与正常路径

| ID | 1 功能名称 | 2 页面 | 3 入口 | 4 用户流程 | 5 旧版文件 | 6 旧版核心 | 7 数据来源 | 8 状态变化 | 9 布局/尺寸 | 10 正常状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | 一次性邀请码门禁 | `auth.html` | 受保护页重定向 | 输入→验证→保存 token→返回原地址 | `authGate.js`、`authPage.js` | `handleGate`、`verifyInviteCode` | `verify_invite_code`、`refresh_invite_access` | pending→anonymous/error→authenticated | 居中单卡；提交尺寸不变 | 90 天滑动、365 天绝对授权 |
| F02 | 导览与全局入口 | `index.html` | 登录成功、全站返回 | 查看统计→进入功能页→返回导览 | `guide.js`、`index.html` | `renderHighlights`、today/history | records、people、quotes | loader→统计/历史弹层 | Logo、三主入口、次级入口 | 统计、提示、历史上的今天完整 |
| F03 | 导航与文档生命周期 | 全部页面 | 返回、卡片、链接、全屏 | 预取→淡出→跳转；离页保存全屏 | `navigation.js` | `prefetchPage`、`restoreFullscreen` | pathname/query/hash、sessionStorage | idle→navigating；fullscreenchange | 95ms 过渡；内容从顶部开始 | 鼠标、键盘、触摸行为一致 |
| F04 | 普通记录列表 | `record.html` | 导览、搜索、统计 | 选择筛选→查看卡片→附件/引用跳转 | `script.js`、`recordRenderer.js` | `applyFilters`、`renderRecords` | `class_records` | criteria→filtered→jump/highlight | 单列阅读轴；紧凑元信息 | 普通记录全部可筛选、可定位 |
| F05 | 书面记录双视图 | `record.html?view=written` | 记录页视图切换、精确引用 | 选页→加载图片/文字→邻页→大图 | `recordRenderer.js` | written page/filter/render | pages、messages、supplements、records | list↔written；pageIndex；hidden | 约 42% 图片列；宽屏 sticky | 图片、箴言、补充、正文同页 |
| F06 | 正文标记语言 | 所有正文页 | 记录/资料/致谢内容 | 解析 AST→安全渲染→引用/预览 | `recordRenderer.js` | balanced parser、format functions | 数据库正文字符串 | plain→nested nodes→interactive marks | 行内基线、表格横滚、对齐块 | 19 类标记、转义与递归有效 |
| F07 | 插图预览与大图查看 | 正文、记录、地图 | `illu`、页面图、地图点击 | 尺寸门→签名→预览→缩放/拖动→关闭 | `imageLoader.js`、`recordRenderer.js` | preload/resolve/viewer handlers | 私有 Storage、尺寸 Range | idle→loading→ready/error→retry | 固定比例 frame；近全屏 Dialog | hover/focus/touch、wheel、drag 可用 |
| F08 | 人物名单 | `people.html` | 导览、侧栏 | 按三组浏览→独立排序→进入人物 | `people.js` | group sort、stats | people、records | 每组 sort/direction 独立 | 学生/老师/其他三张表 | 别名、学科、参与/记录/字数完整 |
| F09 | 人物详情 | `person.html?id=` | 名单、人物标记、时间线 | 读资料→参与/记录切换→筛选→记录 | `person.js` | person lookup、mode/filter | person、records、avatar | id→profile；mode→criteria | 资料卡+记录区；头像稳定占位 | 无 authored 时只显示参与记录 |
| F10 | 名言索引与来源 | `quotes.html` | 导览、搜索、时间线 | 排序→选择名言→定位唯一来源 | `quotes.js`、`quoteStore.js` | first quote、source resolver | records 派生 quotes | sort/direction→source resolution | 双列卡片、来源操作固定 | 首次出现、ID/内容升降序 |
| F11 | 全站搜索 | `search.html?q=` | 导览、URL 深链 | 建索引→输入防抖→分组命中→跳转 | `search.js` | `buildIndex`、`scoreItem`、snippet | records、people、quotes | loading→ready→query/types/results | 搜索框稳定；结果分组 | 不截断、四级权重、命中高亮 |
| F12 | 普通档案答题 | `quiz.html` | 导览、隐藏键序列外 | 筛题型/内容→等权出题→作答→揭示→换题 | `quizCore.js`、`quizApp.js` | source/content/type 三级抽样 | records、messages、supplements、people、quotes | filters→question→answer→feedback | 题型头与卡片齐边；题干最小高度 | 选择/填空/判断及原位校正 |
| F13 | 管理员隐藏答题 | `quiz.html` | admin 输入 `lamian` | 解锁→加载私有题→选择 `???`→逐字符尝试 | `quizApp.js` | secret load、grapheme/progress | `class_quiz_questions`、quiz Storage | locked→loading→exposed→selected→progress | 题图比例锁定；字符方框固定 | 未选时不进入普通池；完整输入判定 |
| F14 | 时间线与多层统计 | `timeline.html` | 导览、日期/人物/名言下钻 | 指标→全局→年度→月度→每日→记录 | `timeline.js` | grouping、fixed scale、pie、ranking | records、people、quotes | metric/year/month/day 联动 | 全局/月/日柱图；三层饼图；日历 | 条数/字数、排行、直接来源跳转 |
| F15 | 补充资料阅读 | `materials.html?id=` | 导览、material 标记 | 选目录→URL 同步→独立滚动正文 | `materialStore.js`、`materials.js` | selection/render/preheat | `class_materials` | id→selected；history→restore | 目录/正文双 ScrollArea | sort_order、标记正文和直达 |
| F16 | 蹭饭图 | `map.html` | 导览 | 元数据→签名缩略图→大图缩放拖动 | `mealMap.js` | map metadata、shared viewer | `class_private_assets`、固定 Storage 路径 | loading→ready/error→viewer | intrinsic ratio，视口内完整显示 | 仅固定 `meal-map.png` 可读取 |
| F17 | 背景与动态主题 | `shop.html` | 导览、全站背景层 | 预览→选择→提色→缓存→下页恢复 | `backgroundSwitcher.js`、`themeBootstrap.js` | extract palette、IO preload | 本地图片、local/sessionStorage | default→loading→selected/error | 16:9 预览；fixed 双背景层 | 背景、署名、palette 首屏无闪白 |
| F18 | 制作组与致谢 | `credits.html` | 侧栏唯一入口 | 加载标题/章节/感谢/附件→标记渲染 | `credits.js` | normalize/render sections | `class_credits_page` | loading→content/empty/error | 双列章节、全宽致谢/附件 | 数据标题同步文档标题；不以 fixed 层遮挡内容 |
| F19 | 多级缓存与加载协调 | 全站 | 页面 loader、数据服务 | memory→session→IDB→network/stale | `cacheLoader.js`、`siteCache.js` | inflight merge、epoch、stale | sessionStorage、IndexedDB、Cache API | cold/hit/stale/error/clear | cache hit 不闪 loader | 授权纪元隔离、hidden 不持久化 |
| F20 | Supabase/RLS/Storage 契约 | 全站 | 每次数据/图片请求 | token header→RPC/RLS→表或对象 | `secureData.js`、`supabaseClient.js`、SQL | signed URL TTL、access functions | PostgreSQL、私有 bucket | normal/admin/revoked/expired | 不直接产生可见布局 | 普通与 hidden 权限严格分离 |
| F21 | 管理上传与安全审计 | CLI | `npm run admin -- ...` | 校验→upsert/upload→显式 prune→报告 | `scripts/admin.mjs`、`sql/*.sql` | retry/batch/manifest/check | 本地私密内容、service role | dry-run/validate/write/prune | CLI 进度稳定 | 不输出 service key；删除需确认 |
| F22 | 404 与部署边界 | `404.html`、部署配置 | 未知路由、受阻静态路径 | 未知路径→公开 404→返回验证/导览 | `404.html`、`vercel.json`、`_redirects` | rewrite/CSP headers | pathname、auth state | unknown→404 | 独立品牌页、无业务数据挂载 | 未登录不消耗邀请码即可看到 404 |

## B. 字段 11–20：异常、细节、迁移差异与验证

| ID | 11 加载状态 | 12 空状态 | 13 错误状态 | 14 边界行为 | 15 微观视觉细节 | 16 当前实现 | 17 已确认差异 | 18 当前框架方案 | 19 实际修改结果 | 20 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | Spinner、页面保持隐藏 | 空输入字段错误 | 复验/配置/邀请码分层说明 | 快速提交锁定；bfcache 复验 | 输入/按钮 44px，禁用不缩放 | `AuthProvider`+`AccessGate`+shadcn Field | 原生脚本门改为 React context | effect 清理、单一重定向所有者 | 会话、返回地址、禁用与清理已恢复 | T/B/P；登录成功待 A |
| F02 | 与卡片形状一致 Skeleton | 数据空时统计为 0 | 可重试 ErrorState | pageshow 回顶；Logo 五击 | Logo 固有尺寸；提示切换不抖 | `HomePage`+Card/Item/Dialog | 独立 DOM 改状态渲染 | memo stats、Dialog 管理历史 | 入口、统计、彩蛋、历史已恢复 | T/B；数据待 A |
| F03 | Suspense Spinner | 无 | 路由失败由 404/错误页承接 | reduced motion；首次手势全屏 | active/focus/hover 明确；移动导航关闭 | `AppShell`+React Router lazy | 文档卸载变 SPA 生命周期 | pathname effect、intent chunk preload | 滚动、预取、全屏偏好已恢复；三类工作区统一锁定视口 | T/B/P/R；普通邀请码导航待 A |
| F04 | PageSkeleton | 无匹配 Empty | 部分/完整加载错误可重试 | 筛选清除 hash；隐藏只驻内存 | 卡片 gap 0；锚点高亮与 scroll-margin | `RecordsPage`+`RecordFilters` | DOM filter 改 URL/state 双向同步 | search params+memo+协调器 | 过滤、隐藏、精确定位完成 | T/B；真实记录待 A |
| F05 | 文字/图片独立 Skeleton | 无页、无文字分别 Empty | 页数据/图片分别重试 | 空图片页保留；有筛选才裁页 | 固定比例、sticky、邻页预载 | written 子视图+shadcn Select | 多 DOM 容器改组件组合 | typed merged entries+bounded retry | 页消息/补充/hidden/翻页完成 | T/B；图片交互待 A |
| F06 | 插图有尺寸门 | 非法标记回退原文 | 单个插图错误不阻断正文 | 30×12、深度限制、转义/XSS | 分式/上下标/下划线基线稳定 | typed AST+`MarkupContent` | innerHTML 改 React nodes | 纯 parser+业务 wrapper+Table | 语法与失败降级已恢复 | T/B；HoverCard 待 A |
| F07 | 固定 frame+Spinner | 缺路径不生成交互 | 自动一次后稳定错误、手动重试 | URL 到期刷新；拖动边界 | loading/ready 同尺寸；Dialog 不跳页 | hooks+`ImageViewer`+HoverCard | imperative overlay 改 Portal | intrinsic metadata+bounded hook | 预览、签名、缩放、拖动完成；资源状态按 path 隔离 | T/B/R；真实 4838×2721 PNG 已解码，普通 token 待 A |
| F08 | 表格 Skeleton | 全名单 Empty | Archive 部分错误保留成功数据 | 三组排序互不影响 | 数字 tabular；移动横滚 | shadcn Table/Select/Button | 手工 table DOM 改声明式行 | per-role state+memo stats | 别名回退、分组排序完成 | T/B；全量名单待 A |
| F09 | 头像/记录 Skeleton | 人物不存在、无记录分离 | 头像无痕失败；数据错误可重试 | URL id 改变重置 mode/filter | 头像尺寸固定；无 authored 不占 Tab | Card/Tabs/RecordFilters | 同页换 id 不再卸载文档 | keyed avatar+id effect | 别名、切换、筛选完成 | T/B；头像/链接待 A |
| F10 | 名言 Skeleton | Empty 说明无标记 | 0/多来源用 Alert | direct file 优先，fallback 必须唯一 | 来源行固定；排序有文字语义 | Card/Select/Alert | alert 字符串改 shadcn Alert | 共享 `quoteRecordTarget` | 来源解析去重并供搜索/时间线复用 | T/B；真实来源待 A |
| F11 | 索引前隐藏结果并 Skeleton | 初始/零命中分别 Empty | 索引失败可重试 | 至少一类；120ms；history restore | 搜索框 48px；摘要两行 | URL params+memo index | DOM 防抖改 effect cleanup | typed index、score、Snippet | 125+ 结果不截断，URL 同步 | T/B；输入/跳转待 A |
| F12 | 题库 Skeleton；切题定位补偿 | 无可生成组合用 Empty | 数据错误与无题不混用 | 取消最后组合被禁用；允许重复抽样 | 透明答案字形常驻；揭示宽度/基线不变 | React engine+Button/Card/Alert | 曾错误排除上一题并移除透明字形 | 三级随机函数+layout effect+CSS 保形 | 精确等权、稳定挖空、齐边题头；题体内滚、反馈 footer 常驻 | T/B/R；真实题目渲染通过，普通 token 待 A |
| F13 | 全题图尺寸门、题图 Spinner | 私有题表为空报错 | Alert+图像重试 | 解锁仅暴露筛选，不自动选中 | 每 grapheme 固定方框；累计位置不移动 | admin RPC+intrinsic frame | 旧 DOM token 改状态数组 | 延迟查询、Set filter、grapheme progress | 本轮修正自动选中差异 | T/B；admin 流程待 A |
| F14 | 时间线 Skeleton | 无记录/无有效日期/空月分别 Empty | 数据错误、名言来源错误 Alert | 空月深链保留；刻度超限按步长扩展 | 三层饼图、每日小饼图、图例联动 | Recharts+Tabs/Card/Badge | 曾缺全局/年度饼图、日饼、精确刻度 | 纯 scale helper+分层 memo+共享来源解析 | 本轮恢复全局/月趋势、年/月饼、日分布与直达 | T/B；图表交互待 A |
| F15 | 双区 Skeleton | 无资料 Empty | 非法 id Alert；加载失败重试 | back/forward 重新从 URL 选择 | 外层锁定视口，两区独立滚动 | ScrollArea+URL params | 文档导航改同页 state | URL 为唯一选中来源 | 单一分栏工作区；空/非法/历史恢复完成 | T/B/R；双滚动区和长文真实数据通过，正文链接待 A |
| F16 | metadata/image Spinner | 元数据缺失说明 | 签名/解码错误可手动重试 | 仅固定路径；自动重签一次 | frame 使用数据库宽高，无 CLS | ImageViewer+单一签名 Hook | 原生 img overlay 改共享 viewer | metadata/URL 分责+bounded retry | 移除竞争 URL 与多余 Range 探测；缩略、大图、失败上限完成 | T/B/R；真实地图资产五视口解码通过，普通 token 待 A |
| F17 | 当前图 eager、其余 lazy Spinner | 默认背景始终存在 | 单预览独立重试 | 安全协议署名；reduced motion | 16:9、560ms 预解码双层淡入、首屏 token | BackgroundRoot+RadioGroup+AspectRatio | 多页面 bootstrap 改 SPA 根背景 | 外部 bootstrap+palette cache+choice card | 首屏恢复、取色、署名、整卡/方向键选择完成 | T/B/P/R；三种预览与交互通过 |
| F18 | PageSkeleton | 三类内容全空时 Empty | ErrorState 重试 | 非空数据库标题覆盖 document.title | 章节两列、长文本舒展 | Card+MarkupContent | DOM template 改类型化数据 | useAsyncData+条件 section | 动态标题、空态、附件完成 | T/B；数据库内容待 A |
| F19 | cache hit 跳过闪烁 | 数据源空交给页面 Empty | stale 回退；部分失败保留成功 | 并发合并、epoch、清权清全缓存 | 占位与成品共享尺寸 | cache/data/archive services | 全局脚本 promise 改模块单例/Context | memory+session+IDB+allSettled | 缓存、安全清理、部分可用完成 | T/B；stale 网络待 A |
| F20 | token 复验期间不挂业务树 | 无授权进入 auth | RLS/签名错误不泄漏敏感值 | 600/180 秒、提前 20%、force refresh | 错误文本不含请求/密钥 | Supabase JS 2.x services | 自托管旧 SDK 改 npm bundle | 每 token client、typed loaders | SQL/表/路径约定保持不变 | T；在线授权边界待 A |
| F21 | CLI 输出分批进度 | 无本地内容明确 skip | 三次重试后汇总失败 | prune 必须 `--confirm-prune` | 日志不回显 secret | 原脚本保持 | 无迁移差异 | 延续唯一管理入口 | 本轮未修改 SQL/上传脚本 | 静态安全测试 T；真实写入未执行 |
| F22 | lazy 404 chunk | 不适用 | 资源不可直读时统一说明 | 未知路径公开；敏感目录 rewrite 404 | 404 不闪业务 loader/背景 | 顶层路由+Vercel headers | 静态 404 改 SPA 公共路由 | protected path 白名单 | 404、CSP、rewrite、返回目标完成 | T/B/P |

## 本轮复核结论

- `F12`：修复了隐藏答案字形未常驻、题型头部与卡片间存在 shadcn Card 默认 padding 缝隙、隐藏题自动进入筛选、排除上一题破坏三级等权四项差异。
- `F14`：修复了全局/年度记录人分布丢失、全档案月趋势丢失、每日作者饼图丢失、Y 轴步长不精确、空月深链被强制跳走、时间线名言不直达来源六项差异。
- `F10/F11/F14`：名言来源解析收敛为同一领域模块，避免三处规则再次漂移。
- shadcn 基础目录仍为只读；所有调整均位于业务组件、领域模块和业务样式层。
