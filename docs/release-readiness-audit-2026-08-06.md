# 发布前完整审查、重构与整改报告（2026-08-06）

## 结论摘要

- 功能基准：`b0923d471abbf85f0bf88fbb635cefbbbb041e37`（2026-07-29，`Update style.css`）。
- 本轮审查起点：`1daa60f63f7a938bcbab9bf03181d91a87627a7c`。
- 结果：类型检查、Biome、11 组自动化回归、正式 Vite 构建、全量及生产依赖审计、匿名在线安全边界和公开路由浏览器回归全部通过。
- 新发现并修复 7 类问题：匿名首屏误做破坏性清理、强制请求竞态、已解码私图周期换 URL、受限 Web Storage 导致初始化中断、Vite 哈希资源缓存过短、路由依赖安全公告、构建期 CLI 被放在运行时依赖。
- `frontend/src/components/ui` 保持只读，本轮 diff 为 0；业务能力通过业务组件、Hook、服务和部署配置完成。
- 发布判断：**代码与构建产物可以部署到预发布环境；当前证据不足以批准直接切正式生产。** 唯一阻断项是未取得有效普通/admin 邀请码，因而无法在本轮执行受保护真实数据页面的 A 类登录态验收，尤其是长记录列表快速滚动、真实图片、管理员隐藏题和完整跨页导航。不得用绕过 RLS 的测试替代这一步。

## 审查方法与证据边界

本轮先读取旧提交而不是修改工作树。基准包含 83 个文件、14 个 HTML 页面和 32 个 `js/*.js` 脚本；按页面、入口、状态、数据、缓存、图片、标记语法、滚动、浮层、响应式和失败边界建立了 F01–F22 功能域。完整的逐字段证据位于：

- [旧版功能规格](./baseline-b0923d4-functional-spec.md)
- [20 字段功能维护矩阵](./baseline-b0923d4-maintenance-matrix.md)
- [旧版源码审查](./legacy-baseline-audit.md)
- [当前版本差异审查](./current-version-gap-audit.md)

验证等级沿用维护矩阵：`T` 为静态/自动化测试，`B` 为生产构建，`P` 为公开真实浏览器，`R` 为受控只读真实数据证据，`A` 为有效邀请码下的真实登录态验收。只有 `A` 可以替代生产用户路径签字。

## A. 旧版本功能审查结果

### A1. 页面与当前路由对应

| 旧版页面 | 旧版职责 | 当前路由/实现 | 迁移判断 |
| --- | --- | --- | --- |
| `auth.html` | 一次性邀请码、复验、返回原地址 | `/auth`、`AuthProvider`、`AccessGate` | 等价状态机；SPA 中集中持有会话 |
| `index.html` | 导览、统计、提示、历史上的今天 | `/`、`HomePage` | 路由懒加载，保留导览行为 |
| `record.html` | 普通/书面记录、筛选、引用、附件 | `/records`、`RecordsPage` | URL 参数与 React state 双向同步 |
| `people.html` | 三类人物、独立排序和统计 | `/people`、`PeoplePage` | 声明式表格和每组独立状态 |
| `person.html?id=` | 人物资料、参与/记录、筛选 | `/person?id=`、`PersonPage` | `id` 变化显式重置局部状态 |
| `quotes.html` | 名言排序与唯一来源 | `/quotes`、`QuotesPage` | 来源解析抽成共享领域函数 |
| `search.html?q=` | 全站索引、权重、摘要、URL 状态 | `/search?q=`、`SearchPage` | 防抖 effect 正确清理，不截断结果 |
| `quiz.html` | 普通题、管理员隐藏题、反馈 | `/quiz`、`QuizPage` | 纯函数题库引擎 + React 状态机 |
| `timeline.html` | 总览、年/月/日统计和下钻 | `/timeline`、`TimelinePage` | 路由级懒加载，Recharts 声明式图表 |
| `materials.html?id=` | 资料目录和独立正文滚动 | `/materials?id=`、`MaterialsPage` | URL 为选中项唯一来源 |
| `map.html` | 私有地图、缩放/拖动 | `/map`、`MealMapPage` | 共享签名 Hook 和查看器 |
| `shop.html` | 背景预览、取色、持久化 | `/backgrounds`、`BackgroundsPage` | 全站根背景与选择页分责 |
| `credits.html` | 制作组、致谢和附件 | `/credits`、`CreditsPage` | 类型化数据和共享标记渲染 |
| `404.html` | 公开错误边界 | `/404` 与未知路径 | 不挂载私有业务树 |

### A2. 不可在迁移中遗漏的规则

- 门禁：90 天滑动、365 天绝对授权；残缺/过期凭证才触发全站缓存擦除；返回地址只消费一次；提交期间输入与按钮同时锁定。
- 记录：year/month/day 联动，重要/例行/全文条件组合；书面页还纳入 page messages 和 supplements；精确引用可保存并恢复来源视图、筛选、页码和滚动。
- 标记：递归平衡 `[[type:...]]`、转义、深度和表格上限；未知/非法标记必须回退为纯文本，不能使用不受控 HTML。
- 答题：来源→内容→题型三级等权；取消最后可用组合要禁用；隐藏答案前不能把真实答案文本放进 DOM；管理员题只在解锁后请求。
- 图片：先有固有尺寸再解码，loading/ready/error 共用几何；签名 URL 只存内存；普通 600 秒、敏感 180 秒；失败只自动强制重签一次，随后进入稳定错误态。
- 缓存：授权纪元隔离；memory→session→IndexedDB→network/stale；同 key 在途合并；hidden 不持久化；清权同时清内存、Web Storage、IDB、Cache Storage、对象 URL 和 Service Worker。
- 生命周期：旧版文档卸载天然清状态，SPA 必须显式处理 route change、bfcache、effect cleanup、移动导航关闭、滚动恢复和全屏偏好。
- 浮层：旧版绝对定位覆盖物迁移为 shadcn/Base UI Portal 后，必须重新处理视口碰撞、焦点返回、触摸、键盘和父级 overflow 裁切。

### A3. 框架差异的处理原则

保留 React 19、React Router、Vite、Tailwind v4 和 shadcn/Base UI，不复制旧 DOM 脚本。旧版“页面重载即重置”改为 keyed state/effect cleanup；旧版命令式 overlay 改为 Portal；旧版全局 Promise 改为模块级协调器；旧版 innerHTML 改为类型化 AST。用户可感知结果和失败边界保持一致，内部实现不机械复刻。

## B. 功能对照结果

下表是 20 字段维护矩阵的发布摘要；旧行为、当前行为、差异原因、修改位置、修复方案和验证方法的完整字段见维护矩阵。

| ID | 功能域 | 最终状态 | 本轮结论/证据 |
| --- | --- | --- | --- |
| F01 | 邀请码门禁 | 已整改，待 A | 修复正常匿名首屏误清全站状态；残缺/过期仍清理；T/B/P |
| F02 | 导览与入口 | 对齐，待 A | 统计、提示、历史弹层、入口保留；T/B，真实统计待 A |
| F03 | 导航与生命周期 | 对齐，待 A | Router 8 懒加载、滚动/全屏/移动导航清理；T/B/P/R |
| F04 | 普通记录列表 | 对齐，待 A | URL 筛选、hidden、精确定位、稳定 key；T/B，长列表快滚待 A |
| F05 | 书面记录 | 对齐，待 A | 双视图、page message/supplement、翻页和稳定图片框；T/B |
| F06 | 正文标记 | 对齐 | 类型化 AST、XSS 回退、19 类标记；T/B，真实浮层待 A |
| F07 | 插图/大图 | 已整改，待 A | 取消周期换 URL，保留按需重签和一次失败恢复；T/B/R |
| F08 | 人物名单 | 对齐，待 A | 三组独立排序和统计；T/B |
| F09 | 人物详情 | 对齐，待 A | `id` 变化复位、头像占位、参与/记录分支；T/B |
| F10 | 名言 | 对齐，待 A | 唯一来源解析与排序；T/B |
| F11 | 搜索 | 对齐，待 A | 四级权重、125+ 不截断、URL 防抖；T/B |
| F12 | 普通答题 | 对齐，待 A | 三级等权、无 DOM 答案泄漏、挖空几何稳定；T/B/R |
| F13 | 管理员答题 | 对齐，待 A | 延迟私有查询、grapheme 进度、题图稳定框；T/B，admin 待 A |
| F14 | 时间线 | 对齐，待 A | 全局/月趋势、年/月/日分布、来源直达；T/B |
| F15 | 资料 | 对齐，待 A | 双独立滚动区、URL 恢复、非法/空/失败分离；T/B/R |
| F16 | 私有地图 | 已整改，待 A | 单一签名所有者、稳定比例、查看器复用；T/B/R |
| F17 | 背景主题 | 已整改 | 受限存储安全降级，固定双层背景和取色缓存；T/B/P/R |
| F18 | 制作与致谢 | 对齐，待 A | 动态标题、条件区块、空/错态；T/B |
| F19 | 多级缓存 | 已整改，待 A | 强制/普通请求同 key 合并，旧请求不误删新占位；T/B |
| F20 | Supabase/RLS/Storage | 已整改，待 A | 在线匿名/伪造 token 均被拒；真实普通/admin token 待 A |
| F21 | 管理 CLI | 未改业务，静态通过 | 写入、prune、密钥输出边界未放宽；未执行真实写操作 |
| F22 | 404/部署 | 已整改 | 公开 404、敏感路径 rewrite、CSP、哈希资源一年 immutable；T/B/P |

一致性统计：22 个功能域均已建立代码对应和维护证据；本轮没有发现未迁移的页面。7 个本轮新问题已修复。19 个涉及受保护真实数据或真实普通/admin 会话的域仍保留 A 类验收标记，不把静态测试写成生产实测。

## C. 本轮实际修改内容

| 模块 | 根因 | 实现 | 涉及文件 | shadcn 处理 |
| --- | --- | --- | --- | --- |
| 门禁初始化 | `null` 同时表示“无凭证”和“坏凭证”，导致正常匿名访问也清 IDB/Cache/SW | `readCandidate` 返回 `{candidate, shouldClear}`；只有残缺、非法、过期才做破坏性清理；返回地址读写安全降级 | `auth-context.tsx`、`site-cache.ts`、门禁测试 | 继续组合 Field/Input/Button；未改 ui 源码 |
| 请求协调 | `force` 绕过在途请求；旧 promise 的 `finally` 可删掉新 promise 占位 | 所有同 key 请求共享 in-flight；删除前做 promise 身份判断 | `services/cache.ts`、缓存测试 | 无 UI 变更 |
| 私有图片 | Hook 用定时器周期换签名 URL，已解码图片会重复签名/下载和闪动 | 删除 interval；仅首次加载、实际再次使用或一次解码失败时重签；`pagehide` 清签名 Promise | `use-signed-asset.ts`、`data.ts`、viewer/markup/records 调用点、图片测试 | 继续用 Dialog/HoverCard 业务组合 |
| 背景持久化 | localStorage 被禁用时读写异常可阻断背景选择/恢复 | try/catch + 会话内 volatile fallback；导出统一 `readBackground` | `background-root.tsx`、`backgrounds-page.tsx` | 继续用 RadioGroup/AspectRatio |
| 路由与依赖安全 | npm 审计发现 Router 7 高危公告；`react-router-dom` 已非官方最新入口 | 按官方迁移至 `react-router@8.3.0`，16 个源文件统一入口；移除 router-dom | app、main、导航/页面文件、package/lock、静态测试 | 无 ui 目录改动 |
| 依赖边界 | 未使用 `framer-motion`、直接 `date-fns` 增加依赖面；`shadcn` CLI 在 runtime | 移除未使用直接依赖；CLI 移到 devDependencies；保留 `@shadcn/react`，因为只读组件中的 MessageScroller 实际使用它 | `frontend/package.json`、lock | 类型检查阻止了误删真实依赖 |
| 部署缓存 | Vite 内容哈希资源只有 5 分钟缓存且匹配不完整 | `/assets/(.*)` 使用一年 `immutable`；非哈希字体/背景/Logo 保持独立 30 天策略；补 schema | `vercel.json`、静态测试 | 无 UI 变更 |

依赖修复还将传递依赖 `hono` 更新为 4.13.0、`fast-uri` 更新为 3.1.5；最终 `npm audit` 与 `npm audit --omit=dev` 均为 0。

## D. 用户点名问题的最终结果

| 问题 | 根因级结果 | 本轮验证边界 |
| --- | --- | --- |
| 答题挖空下划线 | `.quiz-answer-blank` 在揭示前不含答案文本，但按 Unicode code point 计算稳定 `min-width`；揭示前后 padding、字重、基线不变 | 自动化覆盖中英数标点、不同长度、窄屏契约；真实题库待 A |
| 页面背景不明显 | 固定背景根、遮罩、内容表面和 token 已形成层级；无粘性高成本全屏模糊；本轮补存储受限降级 | 1280×720 与 390×844 公开页浏览器通过；受保护内容页待 A |
| 记录页快速滚动 | 当前实现无虚拟列表高度估算、无滚动时 setState、无重复 scroll listener；记录 key 稳定，图片有固有比例占位 | 源码/契约和既有 R 证据通过；本轮没有邀请码，真实生产长列表快滚必须 A |
| 字体小、空白大 | 已建立 page title/section title/reading/control/meta 五级 token；正文 `clamp(1rem…1.075rem)`、行高 1.9；页面容器和卡片节奏统一 | 公开认证/404 两视口通过；各数据页最终内容密度待 A |
| 筛选搜索框顶部空白 | 搜索框直接位于筛选结构顶部，不保留空标题、min-height 或占位节点 | 静态组件契约通过；真实记录筛选交互待 A |
| 加载/缓存 | cache hit 不重复闪 Skeleton；同 key 合并；签名图片不再后台周期换 URL；匿名首屏不清浏览器缓存 | 自动化竞态测试和公开页零 Supabase 请求通过 |
| 全站视觉统一 | 继续使用 shadcn/Base UI 组件、语义 token、统一 PageHeading/AsyncState；未做无依据的大规模换肤 | 公开两视口通过；受保护全页面视觉签字待 A |

## E. 性能与资源结果

### E1. 可验证变化

- 正常匿名 `/auth`：整改前会进入 `clearAllSiteState`，尝试清 local/session、IndexedDB、Cache Storage 和 Service Worker；整改后无任何凭证时直接进入 anonymous，生产预览网络记录中 Supabase 请求数为 0。
- 同 key 强制刷新：整改前可能产生两条并发网络请求；整改后 normal/force 均返回现有 in-flight Promise，自动化以并发身份和调用次数锁定。
- 私有图片：整改前每到 TTL 的 80% 由 interval 改 `src`；整改后后台周期请求为 0，只有下一次真实使用或一次失败恢复才重签。
- 哈希静态资源：缓存从 5 分钟调整为 31,536,000 秒 immutable；内容变化由 Vite 文件名 hash 失效，不会把 HTML 设为 immutable。
- 路由和页面仍按 route lazy import；重量最大的 timeline chunk 不进入未访问路由的执行路径。

### E2. 构建对比

| 指标 | 审查前 | 整改后 | 说明 |
| --- | ---: | ---: | --- |
| CSS raw / gzip | 230.10 / 34.90 kB | 230.10 / 34.90 kB | 无视觉回归式 CSS 膨胀 |
| 主 `index` raw / gzip | 290.78 / 93.22 kB | 267.39 / 85.07 kB | raw -23.39 kB，gzip -8.15 kB；另有 22.49/8.59 kB shared components chunk，不把拆包误报为全部首载收益 |
| data raw / gzip | 219.82 / 57.96 kB | 219.91 / 58.02 kB | 近似不变 |
| timeline raw / gzip | 376.06 / 111.04 kB | 376.10 / 111.06 kB | 近似不变且路由懒加载；后续优化候选，不是当前功能阻断 |
| `dist` 总字节 | 6,082,110 | 6,081,184 | -926 bytes |

性能优化以请求正确性、缓存隔离和布局稳定为优先，没有为缩小数字删除旧版能力。

## F. 实际测试结果

| 检查 | 实际命令/环境 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run typecheck` | 通过，TypeScript 7 project build 无错误 |
| Lint | `npm run lint` | 通过，Biome 检查 52 个文件，0 修复 |
| 自动化回归 | `npm test` | 11/11 组通过：安全边界、私图、图片加载、门禁、缓存、插图尺寸、标记解析、记录视图、答题/时间线刻度、搜索、静态站点 |
| 正式构建 | `npm run build` | 通过，Vite 8.2.0 转换 2875 modules，811ms |
| 依赖审计 | `npm audit`、`npm audit --omit=dev` | 均为 0 vulnerabilities |
| 在线安全边界 | `npm run verify-security-live` | 通过；匿名和伪造 token 无法列 Storage、读受保护表、签名或下载私有对象 |
| 公开桌面浏览器 | 生产 preview，1280×720 | `/auth`、公开 404、受保护路由重定向通过；44px 输入/按钮、单背景层、autofocus、console 0、重复资源 0 |
| 公开窄屏浏览器 | 生产 preview，390×844 | body 与 viewport 一致，无横向溢出；认证卡 358px 宽、x=16；44px 控件 |
| 返回目标 | `/records?year=...#...` 未登录直达 | 正确转 `/auth`，目标由会话状态一次性保存；登录后消费待 A |
| 工作区边界 | `git diff --name-only -- frontend/src/components/ui` | 空；shadcn 基础组件未修改 |
| 补丁质量 | `git diff --check` | 通过，无 whitespace error |

未执行并且不能声称通过的项目：有效普通邀请码登录、admin 邀请码/`lamian` 隐藏题、真实受保护数据的全页面逐页回归、生产规模记录快滚、真实私有图片续签。这些需要授权凭证，不应通过读取本地密钥、伪造 token 或放宽 RLS 完成。

## G. 发布状态

### G1. 可以做什么

当前工作树可重复执行安装、类型检查、lint、测试和正式构建；部署配置、CSP、私有静态路径 rewrite、哈希资源缓存和依赖安全审计均通过。**可以部署到预发布环境进行最终登录态验收。**

### G2. 正式发布阻断项

| 阻断项 | 影响 | 代码文件 | 解决方式 |
| --- | --- | --- | --- |
| 缺有效普通邀请码 A 类验收 | 无法证明 records/people/person/quotes/search/timeline/materials/map/credits 的真实 RLS 数据、返回目标和跨页状态在生产会话完整通过 | 非代码缺陷；覆盖 `frontend/src/pages/*`、`features/auth/*`、`services/data.ts` | 在预发布签发普通邀请码，按 F01–F20 矩阵逐项浏览器复核；不得绕过 RLS |
| 缺 admin A 类验收 | 无法证明 hidden records、私有 quiz 表/题图、管理员权限分离的用户路径 | `quiz-page.tsx`、records hidden 分支、Supabase RPC/SQL 契约 | 用受控 admin 邀请码测试，结束后撤销会话并运行安全复核 |
| 缺生产规模长列表快滚实测 | 代码已去除已知根因，但无法以公开空会话验证真实图片解码和大量记录组合下的帧稳定性 | `records-page.tsx`、`record-card.tsx`、`use-signed-asset.ts` | 登录后在桌面/移动端连续上下滚动、快速组合筛选，观察重复/空白/跳位/console/network |

### G3. 放行标准

完成以上 A 类测试且无失败后，本报告的发布结论可从“预发布可部署”改为“正式生产可发布”。在此之前直接切生产不符合用户要求的“完整、深入、可验证”，因此本轮不做虚假放行。

## 维护注意事项

- `frontend/src/components/ui` 继续只读；新增需求在业务组件中通过 `className`、variant 或组合完成。
- 签名 URL 的 80% 是“缓存提前失效点”，不是后台刷新定时器；不要恢复 interval。
- `force` 表示跳过缓存结果，不表示绕过同 key 在途合并。
- 不要把 Router 8 的源导入重新改回 `react-router-dom`。
- timeline 111.06 kB gzip 是后续性能预算候选；优化时先保持图表交互和统计规则，不以删除能力换体积。
