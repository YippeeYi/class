# 《旧版本完整功能规格说明》

基准提交：`b0923d471abbf85f0bf88fbb635cefbbbb041e37`  
提交时间：2026-07-29 16:51:47 +0800  
审查范围：提交中的全部 HTML、CSS、JavaScript、SQL、部署配置、管理脚本、资源约定、说明文档和自动化测试。

## 1. 产品边界与总体架构

- 产品是无自建后端的静态班级档案站。页面运行在浏览器中，Supabase 提供 PostgreSQL、RPC、RLS 和私有 Storage。
- 前端由 14 个独立 HTML 入口、31 个脚本、统一 `style.css` 组成。所有受保护页面先经过邀请码门禁，再按页面加载共享数据仓库和页面控制器。
- 运行时不读取仓库里的私密源文件；内容和私有二进制均由 Supabase 提供。`private-assets/` 只供管理员上传脚本使用并被 Git 忽略。
- 全站 CSP 只允许同源脚本及指定 Supabase 项目连接；Supabase 2.45.0 SDK 自托管并校验 SRI，不依赖 CDN，不启用第三方分析。
- 页面共享导航过渡、背景主题、加载/错误状态、正文标记解析、图片查看器、数据缓存和安全资源解析能力。

## 2. 页面与跳转关系

| 页面 | 目的与用户效果 | 入口/出口 | 关键实现 |
| --- | --- | --- | --- |
| `auth.html` | 输入一次性邀请码；提交期间禁用表单并显示“验证中”；错误通过 `aria-live` 宣读且连续失败有强调动画 | 未授权访问自动跳入；成功返回原路径或导览页 | `authGate.js`、`authPage.js`、`supabaseClient.js` |
| `index.html` | Logo、记录/人物/名言统计、七个次级入口、轮换提示、历史上的今天、移除访问权限 | 通往其余全部业务页 | `guide.js` |
| `record.html` | 普通记录列表、书面记录双视图；日期/重要/日常排除/关键词筛选；隐藏记录入口 | 可由搜索、名言、统计、正文记录引用精确跳入 | `script.js`、`recordRenderer.js`、`recordStore.js` |
| `people.html` | 同时展示同学、老师、其他三个分组及独立排序统计 | 整行进入 `person.html?id=...` | `people.js` |
| `person.html` | 人物姓名、别名、简介、头像；参与/记录事件切换及同一套记录筛选 | 人物标记、名单、统计进入；记录引用可继续跳转 | `person.js` |
| `quotes.html` | 从普通记录 `[[quote:...]]` 派生名言，按 ID/内容升降序 | 行点击定位唯一来源记录 | `quotes.js`、`quoteStore.js` |
| `timeline.html` | 全局、年度、月度、每日多级统计；条数/字数指标切换 | 人物、名言、日期、记录均可下钻 | `timeline.js` |
| `search.html` | 建立记录/人物/名言全量索引，分组显示带高亮摘要的所有命中 | 进入人物页或精确来源记录 | `search.js` |
| `quiz.html` | 从记录实时生成选择/填空/判断题；管理员可解锁隐藏题池 | 独立互动页 | `quizCore.js`、`quizApp.js` |
| `materials.html` | 左侧资料列表、右侧正文；支持 URL `id` 直达 | 正文 `material` 标记可进入 | `materialStore.js`、`materials.js` |
| `map.html` | 门禁后的私有蹭饭图；缩略展示、点击大图、滚轮缩放、拖动浏览 | 导览进入 | `mealMap.js`、共享图片查看器 |
| `shop.html` | 背景预览、来源署名、切换全站背景 | 导览进入 | `backgroundSwitcher.js`、`shop.js` |
| `credits.html` | 制作组、致谢、附件分区，正文支持统一标记 | 导览进入 | `credits.js` |
| `404.html` | 明确说明页面不存在或资源不可直接访问，并返回验证页 | 未知/被阻止路径 | 静态页 |

所有非导览页的返回按钮会被统一为“返回导览页面”。卡片和按钮支持鼠标、键盘 Enter/Space；内部导航有约 95ms 淡出过渡并尊重 `prefers-reduced-motion`。悬停、聚焦、触摸导航目标时使用 `<link rel="prefetch" as="document">` 预取合法同源 HTML 页面。

## 3. 邀请码、权限与安全会话

### 3.1 浏览器流程

- 本地只保存 `classRecord:inviteAccess`（一次性获得的 64 位访问令牌、授权时间、最近服务端验证时间）和 `classRecord:lastVisitAt`，不保存邀请码。
- 本地候选状态必须同时满足：类型为 `invite`、令牌存在、90 天内访问过、授权不超过 365 天；随后仍必须调用 `refresh_invite_access` 服务端复验才能显示页面。
- 未授权访问会把完整 pathname、query、hash 存入 `classRecordRedirectTarget`，跳往验证页；成功后使用 `location.replace` 返回。
- 清除权限会广播缓存清理事件，清空 local/session storage、IndexedDB、Cache Storage、同源 Service Worker、内存数据、签名 URL、对象 URL、隐藏模式和主题快照。
- bfcache 恢复时重新校验令牌；私有图片会移除旧绑定并重新签名，避免恢复过期 URL。
- 配置/SDK 初始化失败只在验证页显示可访问的配置错误状态；普通受保护页回到验证页。

### 3.2 数据库模型与 RPC

- `invite_code_settings`：单行 pepper，至少 16 字符。
- `invite_codes`：只存 peppered hash、一次性使用状态、过期时间、备注、`normal/admin` 等级。
- `invite_access_sessions`：token hash、创建/最近使用/绝对过期/撤销时间、权限级别、来源指纹、10 分钟刷新窗口计数、风险标记。
- `invite_code_attempts`：仅存哈希化尝试维度和成功状态，24 小时清理。
- `verify_invite_code`：去空白并大写；空值或超过 64 字符失败；同源 15 分钟失败 20 次、同码 30 分钟失败 10 次、全局 5 分钟 300 次限流；原子消费未使用且未过期的邀请码；生成 32 字节随机令牌，只返回原令牌一次。
- `refresh_invite_access`：校验 64 字符令牌、90 天滑动/365 天绝对有效期与撤销状态；更新 `last_seen_at`；10 分钟超过 60 次标记 `high_refresh_rate`；5 分钟内来源突变标记 `rapid_origin_change`，但不直接封禁。
- `has_class_record_access` / `has_class_record_admin_access`：从请求头 `x-class-record-access` 读取令牌并在每次 PostgREST/Storage 读取时复核。
- service-role 独占：列出会话、统计 active/normal/admin/revoked/expired/risk、撤销单个/全部会话、清理尝试日志。

## 4. 数据结构与流向

| 表 | 主要字段 | 前端用途 | 权限 |
| --- | --- | --- | --- |
| `class_records` | file/id/index/date/time/author/content/importance/hidden/attachments/image/raw | 记录、人物统计、搜索、名言、答题、时间线 | 普通行需 access；hidden 另需 admin |
| `class_people` | id/name/aliases/alias/role/subject/main/bio/avatar/raw | 名单、人物详情、标记显示、题目干扰项 | access |
| `class_record_pages` | page/start/end/image/hidden/sort/raw | 书面页范围与图片 | hidden 需 admin |
| `class_page_messages` | page/content/author/raw | 书面页“箴言” | access |
| `class_page_supplements` | file/page/index/author/content/hidden/sort/raw | 书面页补充记录、搜索筛选、答题来源 | hidden 需 admin |
| `class_materials` | id/title/content/sort/raw | 资料页与 `material` 引用 | access |
| `class_quiz_questions` | id/content/group/type/prompt/choices/answer/explanation/image/sort/raw | 管理员隐藏 `lamian` 题池 | admin |
| `class_credits_page` | 固定 `main`、title/sections/thanks/original_images/raw | 致谢页 | access |
| `class_private_assets` | 固定 `meal-map`、width/height/updated_at | 地图存在性和固有尺寸；不暴露路径 | access |

Storage 只允许 `classrecord-private`：普通附件和书面页需 access；`hidden/...` 与 `images/quiz/...` 另需 admin；地图仅允许固定 `images/private/meal-map.png`。前端无写权限。

## 5. 缓存、加载和异常恢复

- 公共数据采用三级缓存：内存 → `sessionStorage`（默认 15 分钟）→ IndexedDB（新鲜 24 小时、最多 7 天 stale）。缓存键包含授权纪元 `authorizedAt`，新邀请码不能读取旧会话缓存。
- 同 key 并发请求合并。网络失败时可使用仍在 stale 窗口内且已经过授权隔离的持久缓存。
- hidden 数据明确 `sessionExpire: 0`、不持久化，普通记录/人物/资料/页面配置等可持久化。
- 首屏在同步命中 session cache 时不显示闪烁 loader；共享 Loading 是垂直、紧凑、可访问状态，错误状态支持重试。
- 公共图片协调器以稳定资源 key 去重，内存和 Cache Storage 复用 24 小时，最大 4 并发，高优先级先执行；损坏/过期条目会删除并重取。
- 私有图片可缓存已获取的二进制响应，但签名 URL 本身只在内存保存；对象 URL 在清理时统一 revoke。
- 普通资源签名寿命 600 秒，地图/hidden/quiz 等敏感资源 180 秒；在过期前 20% 提前刷新；失败短暂抑制重复请求，强制刷新可绕过。
- 图片变体 cache key 包含路径、transform 和版本，原图与 1200×1800/quality 78 的显示图互不污染；Storage 不支持 transform 时回退原图并避免反复失败。

## 6. 记录正文语法与交互

唯一合法语法是递归平衡的 `[[type:...]]`；支持 `\|`、`\[`、`\]`、`\\` 转义，最大递归深度受控。所有原始 HTML 先转义；未知、非法、未闭合语法按普通文本显示。

| 标记 | 行为 |
| --- | --- |
| `person:id|label` | 人物引用；参与统计；点击人物页 |
| `author:id|label` | 额外记录人；计入作者但不计参与者 |
| `quote:id|text` | 名言来源；派生名言索引 |
| `record:file|label` | 精确记录跳转 |
| `material:id|label` | 资料直达 |
| `frac:top|bottom` | 上下分式排版 |
| `anno:note|label` | 悬停/聚焦/触摸注释预览 |
| `illu:file|label` | 私有插图预览与大图查看；仅允许白名单图片扩展名和安全文件名；`hidden/` 自动重写 |
| `del/under/red/hide/sup/sub/center/right` | 删除、下划线、红色、黑幕、上下标、居中、右对齐 |
| `arrow:top|bottom` | 上下箭头注记 |
| `table:RxC|...` | 最多 30×12，嵌套标记，按汉字/可见字符估算列宽，长表扩展并横向滚动 |

- 注释/插图预览支持鼠标、键盘和触摸，延迟打开/关闭；跨行标记使用多 rect 定位，避开视口和触发文字，滚动时关闭。
- 全部公共内容源（普通记录、名言、页消息、页补充、资料、致谢）在可渲染前扫描插图；批量签名后仅 Range 请求前 64 KiB 解析 PNG/JPEG/GIF/WebP 尺寸，尺寸写入授权隔离缓存。
- hover 时先显示已预留正确比例的 frame，再异步填入显示图，不发生二次尺寸跳动；页面渲染后只预热当前可见正文图片。
- 大图查看器先签原图，失败再使用已展示 URL；签名过期会强制刷新。支持 0.25 倍起的滚轮指针中心缩放、实际像素尺寸放大、拖动、边界约束、响应式 fit 和关闭。

## 7. 记录页详细行为

- 两种视图：按条列表、书面记录；`view=written` 可直达，切换同步 URL。
- 筛选：year/month/day 联动、仅重要、排除每日例行、全文 query；搜索文本包含 id、文件、日期、时间、作者、正文可见文本及附件名。
- 筛选状态写入 query；清除筛选同时清除精确跳转状态和 hash。
- 列表只包含普通记录。书面视图在普通记录之外纳入页消息和页补充，因此它们参与日期、重要、作者、人物/名言文本和关键词筛选。
- 无筛选时保留只有图片或页消息的书面页；有筛选时只保留至少一个普通/消息/补充命中的页。
- 书面页有上一页、下一页、总页数、下拉直达；加载当前显示变体并在 idle 时预加载相邻页；点击进入原图查看器。
- 外部搜索/名言/统计进入记录后，目标以共享长尾 ease-out 平滑滚动并高亮。完成后在目标旁显示“留在这里/返回原位置”对话框；内部记录引用会暂时清筛选、定位目标并可恢复原视图、页码、筛选和滚动。
- `qibaishihuaxia` 键序列（输入控件外、无修饰键）触发 admin 校验；成功加载 hidden 记录。隐藏模式只在内存，刷新即退出；同时支持 hidden 书面页、过滤和明确状态提示。

## 8. 人物、名言、搜索和资料

### 人物

- 三个角色分组同时存在，各自维护排序字段和升降序，不互相重置。
- 同学列：序号、姓名、别名、参与、记录、记录字数；老师列另有学科；其他只保留公共统计列。
- 参与次数来自 `person` 标记；记录次数来自主作者和 `author` 标记去重；记录字数只归主 `author`。
- 老师学科按语数英物化生史政地固定顺序，未知置后；“主要”按钮可把 `main=true` 老师置顶且组内继续按当前字段排序。
- 人物详情先展示资料和可选签名头像，再加载记录；头像失败无痕移除。参与/记录切换会重置筛选，若无 authored 则隐藏切换器。

### 名言

- 每个 quote id 只取普通记录中首次出现者，按来源日期后 ID 排序；可改为内容排序并切换升降序。
- 点击行：唯一来源则精确跳转；0 或多个来源会 alert 并记录不含敏感请求内容的诊断。

### 搜索

- 数据就绪前隐藏输入和结果，仅显示中性 loader；加载完成聚焦输入。
- 初始 `q` 从 URL 读取，输入 120ms 防抖并用 `history.replaceState` 同步 URL。
- 记录索引包含附件名/文件；人物包含别名、简介、角色；名言包含日期和关联人物。
- 匹配权重：标题全等 100、前缀 80、标题包含 62、正文包含 36；同分按 sort key 降序。
- 结果按记录/人物/名言分组，生成命中附近摘要并用 `<mark>` 高亮；不截断结果数量。至少保留一个类型筛选。

### 资料与致谢

- 资料按 `sort_order`，URL id 合法则选中，否则默认第一项；无数据、无效 id、加载失败分别处理；切换资料后预热其插图。
- 致谢支持章节成员、感谢段落、附件文字；标题可由数据库覆盖页面标题；内容统一走标记解析，空数据和失败状态不同。

## 9. 答题系统

- 普通题目从普通记录、页消息、页补充实时生成；文件名以 `-00` 结尾的记录不进入普通题池。
- 内容类型：人物、名言、记录人支持选择/填空/判断；日期只支持选择；管理员隐藏 `lamian` 只支持填空。
- 抽样顺序是“合格来源等权 → 来源内可用内容等权 → 内容内题型等权”，同一来源满足多个内容时只出现一次。
- 筛选不会自动替用户改变另一组；未选项始终可选；如果取消会造成无法出题，则该已选项禁用；提供“全选可用”。
- 人物/名言选择与填空把正文目标挖空；人物选择尽量构造四个唯一、合理别名干扰项；记录人选择需要三个其他作者；日期干扰项优先选择日期距离较远者。
- 判断题随机正确/错误。错误人物可替换一个或多个同人物别名并精确记录多个校正位置；名言/记录人也生成替换；作答后原位置显示错词与正确词。
- 填空比较执行 NFC、trim、lowercase；选择题以 A-D 展示，判断题以 ✓/×；作答后禁用、标正确/错误、展示答案并触发卡片反馈动画。
- `lamian` 键序列只有 admin 才可解锁；解锁后才强制查询私有题表，不为普通用户预查询。隐藏题图从私有 Storage 加载，失败可重试，敏感签名 180 秒。
- 隐藏填空按 Unicode 字符显示方框；输入长度必须完全一致；每次只填入位置正确的新字符，允许多次尝试直至全部正确。

## 10. 时间线与统计

- 可切换“记录条数/记录字数”，所有总览、月/日柱形、人物/作者排名随指标变化。
- 总览包括总量、重要记录、活跃人物、名言等；年份列表、所选年份 12 月概览、月列表和所选月详情逐级联动。
- 年/月汇总人物、作者、名言计数，显示前三/前十等排名；人物和作者 chip 进入人物页，名言 chip 在唯一来源时进入记录。
- 月详情生成完整日历天数，逐日柱形/格子和当天记录；没有记录的月份仍有稳定空结构。
- 作者分布使用 SVG 饼图；摘要图最多六片，其余合并“其他”；每日图可保留更多作者。未知作者颜色按稳定黄金角 HSL 生成。
- 图例与饼图片段通过 pointer/focus 相互高亮，标记为圆点；柱图固定刻度对常见范围使用预设上限，超过后扩展到整步长。

## 11. 背景、主题、动画与响应式

- 背景选项含默认纸本渐变、山、云；图片来源链接只允许安全 inline 标签和 http/https/mailto，并强制新窗口 noopener。
- 背景 ID 持久化；首屏 `themeBootstrap` 在 CSS 前读取选项并预加载背景，使用缓存主题快照避免闪白。
- 图片背景通过缩小采样 canvas 加权提取主色，转 HSL 后生成 accent、surface、focus、overlay、panel、table、tooltip 等完整 token；session/local 双层 palette cache。
- 背景预览：当前项高优先级，其余 IntersectionObserver 延迟加载，距视口 240px 预取；hover 提升优先级；加载/错误/重试状态统一。
- 全屏偏好在页面跳转间用 session 保存，页面 load 或首次 pointerdown 尝试恢复；背景模块提供全屏控制并同步标签。
- Logo 单击有轻动画，1.2 秒内五击触发彩蛋动画；提示随机起始且每 3.6 秒切换、280ms 过渡；导览页禁用浏览器滚动恢复并在 pageshow 回到顶部。
- 响应式覆盖手机、平板、桌面；图片查看器、tooltip、表格、书面双栏、时间线控件均限制在视口并尊重减少动态效果偏好。

## 12. 管理脚本、部署与回归契约

- `scripts/admin.mjs` 是统一入口：上传/校验内容及私有资产、生成/列出/检查邀请码、查看/撤销访问会话；service-role key 不输出。
- 上传最多重试 3 次并可控并发；只上传内容实际引用的二进制；远端删除必须显式 `--confirm-prune`；地图路径固定且数据库只写尺寸元数据。
- `sql/check.sql` 审核表/列/RLS、唯一 Storage SELECT policy、匿名无写授权、函数权限和 schema drift。
- 11 组测试锁定：门禁静态加载器、授权隔离缓存、全内容插图尺寸门、图片去重/过期/并发、答题约束与等权、递归标记/XSS/图片几何、书面页补充筛选、125 条搜索不截断、私有图片变体与 bfcache、SQL/上传安全边界、全部静态页面/CSP/加载/UI 契约。

