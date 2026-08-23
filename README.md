# 编日史（Class Record）

编日史是一套面向班级内部的只读档案网站。它把日常记录、人物、原话、书面页、补充资料、统计和答题统一到一个 React 单页应用中；结构化内容与私有资源来自 Supabase，访问者必须先使用一次性邀请码换取服务端访问凭证。

本文件只描述当前代码真实实现。`docs/` 中带 baseline、audit、report 或日期的文件是历史审查快照，不应覆盖本 README、当前源码、`sql/setup.sql` 和 `sql/check.sql` 的现行约定。

## 产品边界与安全模型

- 网站没有注册、账号、密码、个人中心或用户身份表。
- 一次性邀请码由 `verify_invite_code` RPC 原子校验并作废，成功后换取一个 256 位随机访问 token；浏览器不保存原始邀请码。
- token 通过 `x-class-record-access` 请求头发送。表 RLS、Storage policy 和签名 URL 都在服务端重新验证 token，修改浏览器本地数据不能生成权限。
- 普通会话只能读取普通档案；管理员会话才可读取隐藏记录、隐藏书面页、隐藏补充和隐藏题图。
- 浏览器候选凭证采用 90 天闲置期限和 365 天绝对期限；每次恢复页面都要调用 `refresh_invite_access` 服务端复验。
- 前端不提交评论、收藏、表情、分享、答题结果、纠错或其他业务数据。仅访问凭证、缓存、外观偏好和全屏偏好保存在本机。
- “移除访问权限”会清除凭证、外观和 Web Storage，并清理内存数据、签名 URL、IndexedDB、Cache Storage 和同源 Service Worker；下次访问需要新邀请码。
- 已签发的普通资源 URL 最长有效 600 秒；地图、`hidden/` 和 `images/quiz/` 等敏感资源最长 180 秒。

更完整的威胁模型、撤销与管理员检查方式见 [访问权限安全模型](docs/access-security-model.md)。

## 页面与功能

| 路由 | 页面职责与主要交互 |
| --- | --- |
| `/auth` | 邀请码验证。输入与提交在请求期间统一禁用并显示 loading；验证成功后只消费一次同源回跳地址。 |
| `/` | 导览。显示记录、人物、名言数量，提供核心入口和工具入口；当天存在历史记录时显示“历史上的今天”。 |
| `/records` | 记录浏览。支持列表/书面模式、正文搜索、年月日联动筛选、仅重要、排除每日例行、附件与记录引用跳转。 |
| `/people` | 人物。按同学、老师、其他分组；每组可独立按 ID、参与数、记录数、字数或学科排序，老师可优先显示主要老师。 |
| `/person?id=...` | 人物详情。显示别名、身份、学科、头像、简介，以及“参与事件/记录事件”两类相关记录和同一套记录筛选。 |
| `/quotes` | 名言列表。按 ID 或内容升降序；名言从记录标记派生，点击可定位到对应书面记录。匹配缺失或不唯一时显示明确错误。 |
| `/timeline` | 统计。可切换记录条数/正文字符数，查看全局、年度、月度和每日趋势、记录人分布、重要记录、活跃人物与名言等数据。 |
| `/search?q=...` | 搜索。120ms 防抖，按相关度搜索记录、箴言、页补充、人物和名言，可组合开关记录/人物/名言三类结果。 |
| `/quiz` | 答题。由记录、页补充、人物和名言实时生成选择、填空、判断题；支持题型/内容筛选、换题、即时判题和本次页面分数。 |
| `/materials?id=...` | 资料阅读。URL 保存当前资料；目录与正文独立滚动，非法 ID 会回退到第一项并提示。 |
| `/map` | 私有地图。固定比例占位、短时签名加载、有界自动重签和手动重试；可进入统一大图查看器。 |
| `/backgrounds` | 风格设置。独立组合配色、背景和方框风格，选择即时生效并持久化。 |
| `/credits` | 致谢。展示分组成员、致谢正文和附件说明，支持统一正文标记。 |
| `/404`、未知路径 | 公开 404，不挂载档案数据。受保护路由允许尾斜杠，但不会把未知子路径放入受保护应用。 |

### 全局壳层与导航

- 桌面端使用可折叠 shadcn Sidebar，移动端使用同一组件的 Sheet 行为；切换路由后移动侧栏自动关闭。
- 顶栏统一包含侧栏触发器、面包屑、页面级操作和全屏切换。人物详情会在顶栏显示当前人物名，同时侧栏仍选中“人物”。
- 路由前进时统一回到顶部，浏览器后退/前进保留原生 POP 位置；记录引用跳转由记录页独占一次测量滚动，避免二次回弹。
- 导航项在 pointer/focus 意图出现时预加载对应按需 chunk；页面仍由 React Router lazy route 拆分。
- 根级错误边界会接管渲染异常和 lazy chunk 下载失败，提供重新加载/返回导览恢复入口；仅在当前标签页保存诊断编号、故障类型、构建模式、路径和时间，不记录查询参数、fragment、正文或访问凭证。
- 提供“跳到主要内容”链接、focus-visible、键盘可操作浮层、可读 loading/empty/error 状态，并尊重 `prefers-reduced-motion`。

### 记录与书面页

`/records` 的 URL 参数是可恢复状态：

| 参数 | 含义 |
| --- | --- |
| `view=written` | 打开书面记录模式；省略时为列表模式。 |
| `q` | 只搜索渲染后的记录正文，不把日期、记录人或附件名混入。 |
| `year`、`month`、`day` | 日期筛选；选择项根据其他日期条件联动生成。 |
| `important=1` | 仅显示重要记录。 |
| `excludeDaily=1` | 排除文件名以 `-00` 结尾的每日例行记录。 |

书面模式按 `class_record_pages` 的起止文件映射记录，显示原始页图、对应文字记录、页箴言和页补充；支持上一页、下一页、页码 Select，以及相邻页图片预热。筛选条件同样作用于书面页及补充记录。书面页清单加载失败时显示整页错误；页箴言或页补录单独失败时降级为空集合，保留书面页和其余已成功内容，并显示可重试的部分失败提示。

正文中的记录/名言引用会先清理筛选并定位目标，完成后可返回跳转前的视图、筛选、页码和滚动位置。损坏或恶意 fragment 会安全忽略，不会让页面抛出 URI 错误。附件只在用户展开并点击时请求签名 URL。

### 人物、名言、搜索与统计规则

- `[[person:...]]` 计入人物参与事件；记录 JSON 的 `author` 与 `[[author:...]]` 计入记录事件。
- 人物统计和详情会复用已解析的引用/字符缓存；页箴言与页补充会异步补入人物详情，不阻塞基本资料首屏。
- 名言不是独立手工表：`loadQuotes` 从普通记录里的 `[[quote:...]]` 标记去重派生，并保留来源记录与日期。
- 搜索索引记录全部可见字段、附件名、页箴言、页补充、人物资料和名言；结果先按标题完全匹配、前缀、包含、正文包含分级，再按时间/稳定键排序，不做静默截断。
- 时间轴只统计拥有真实有效日历日期的普通记录。不存在的日期（如 2 月 31 日）不会进入年/月/日聚合。
- 图表使用 Recharts 与 shadcn Chart；图例 hover/focus 通过同一个持久高亮状态联动，不通过放大扇形改变布局。年份、月份和名言可继续跳到对应记录视图。

### 答题规则

- 普通题由记录、页箴言、页补充、人物和名言在浏览器内生成；每日例行记录不参与生成。
- 题源先等权选择，再在该题源的可用内容与题型中选择，避免题目多的单条记录获得更高概率。
- 题型包括选择、填空、判断；内容包括记录人、记录时间、人名和名言。筛选不会允许用户移除到零个可生成组合。
- 填空与判断使用统一正文 AST 的安全子集；需要猜测的目标标签被替换为空位，敏感 ID、注释正文和插图路径不会进入题面树。
- 最终提交使用同步锁防止快速双击重复计分；答案、输入、结果和隐藏题进度在换题时一起重置。分数只存在当前页面，不上传。
- 管理员会话输入 `lamian` 后才按需读取隐藏题库；普通会话不会读取隐藏题行或题图。隐藏填空按 grapheme 校验长度，并保留本轮已猜中的字符位置。

### 图片、浮层与大图

- 记录书面页、正文插图、人物头像、题图和地图都使用 Supabase Storage 私有对象；签名 URL 只保存在内存。
- 图片尺寸元数据使用内存、会话和 IndexedDB 缓存，并尽量用 Range 请求解析 PNG/JPEG/GIF/WebP/SVG 尺寸，减少加载前布局跳动。
- 图片解码失败最多自动强制重签一次；后续失败保持可见错误并等待用户手动重试，避免无限请求循环。
- 注解和插图预览使用 shadcn HoverCard，支持鼠标、键盘与触控；滚动其祖先容器时会关闭，避免浮层脱离锚点。
- 大图查看器组合 shadcn Dialog、Tooltip 和 Button，支持 1×–8× 缩放、滚轮/双击/双指缩放、拖动、方向键移动、复位和焦点锁定。

### 风格设置

外观状态统一保存在 `classRecord:appearance:v1`：

- 配色：随背景自动取色，加 5 套浅色预设（纸白、雾蓝、暖杏、柔苔、莓霜）和 4 套深色预设（夜墨、深海、松夜、极光）。
- 背景：纸本、山、云；图片背景包含署名安全外链、预览 loading/error/retry 和代表色。
- 方框：利落小角、标准圆角、圆角方框；只改变统一圆角/滚动条几何，不改变业务布局。

`public/theme-bootstrap.js` 会在 React 启动前恢复背景、配色、dark class 和已缓存 palette，避免首屏闪白。运行期换背景先解码，再通过固定双层背景淡入。

## 数据来源与数据流

### Supabase 表与用途

| 表 | 前端用途 | 权限 |
| --- | --- | --- |
| `class_records` | 普通/隐藏记录、附件、重要标记、正文 | 普通可读普通行；管理员可读 hidden 行 |
| `class_people` | 人物基本资料、角色、学科、头像 | 有效会话可读 |
| `class_record_pages` | 书面页范围、排序、图像路径 | 普通/管理员按 hidden 分级 |
| `class_page_messages` | 每页箴言 | 有效会话可读 |
| `class_page_supplements` | 每页补充记录 | 普通/管理员按 hidden 分级 |
| `class_materials` | 资料目录与正文 | 有效会话可读 |
| `class_quiz_questions` | 管理员隐藏题 | 仅管理员可读 |
| `class_credits_page` | 制作组、致谢、附件说明 | 有效会话可读 |
| `class_private_assets` | 地图等私有资源的无路径尺寸元数据 | 有效会话可读 |

私有二进制对象位于非公开 `classrecord-private` bucket。普通允许路径为 `data/attachments/`、`images/record-pages/` 和 `images/private/meal-map.png`；管理员另可访问 `hidden/` 与 `images/quiz/` 中的资源。源 JSON 不上传到 Storage。

### 前端加载与缓存

1. `AuthProvider` 从本机读取候选 token，并调用 `refresh_invite_access`。未通过前不挂载业务数据树。
2. `ArchiveProvider` 按需并行加载记录和人物，再从记录派生名言；其中一类失败时保留已成功的数据，并向页面暴露部分失败。
3. 页面专属数据在进入页面后再加载：书面页、资料、隐藏题、地图元数据、风格资源和致谢不会由导览页全量预取。
4. `loadCached` 合并同授权范围、同 key 的在途请求。默认缓存层为内存 → 15 分钟 sessionStorage → IndexedDB（24 小时新鲜、最多 7 天 stale）→ 网络。
5. 网络失败时只允许回退到同一授权范围内仍在 stale 窗口的数据。缓存 scope 包含授权时间，新的邀请码不会读取旧会话缓存。
6. hidden 数据和管理员隐藏题不写入 sessionStorage/IndexedDB；签名 URL 也从不持久化。

`force` 表示绕过已完成缓存，不表示制造重复请求；同 key 的在途请求仍合并。达到签名寿命 80% 后，仅下一次真实使用会重签，不存在后台 interval 定时替换已解码图片。

## 记录正文标记

正文、人物简介、资料和致谢使用统一的平衡括号语法 `[[type:参数]]`。解析结果是类型化 AST，React 直接渲染文本节点，不拼接 HTML，也不使用 `dangerouslySetInnerHTML`。

| 功能 | 写法 |
| --- | --- |
| 人物参与者 / 额外记录人 | `[[person:人物ID|显示文字]]` / `[[author:人物ID|显示文字]]` |
| 名言 / 记录 / 资料引用 | `[[quote:名言ID|原话]]` / `[[record:文件名|文字]]` / `[[material:资料ID|文字]]` |
| 注解 / 插图 | `[[anno:注解内容|被注释文字]]` / `[[illu:example.png|被标记文字]]` |
| 分式 / 方程式箭头 | `[[frac:上方|下方]]` / `[[arrow:上方|下方]]` |
| 样式 | `[[del:删除线]]`、`[[under:下划线]]`、`[[red:标红]]`、`[[hide:黑幕]]` |
| 上下标与对齐 | `[[sup:上标]]`、`[[sub:下标]]`、`[[center:居中]]`、`[[right:右对齐]]` |
| 表格 | `[[table:2x3|A1|A2|A3|B1|B2|B3]]` |

标记参数可以递归嵌套，最大解析深度为 24。表格限制为 1–30 行、1–12 列。使用 `\|`、`\[`、`\]`、`\\` 转义特殊字符；在 JSON 字符串中反斜杠还需再次转义。未知类型、非法 ID、非法插图路径、缺少参数或未闭合标记会按原文显示。

普通 `illu` 参数只能是安全图片文件名；渲染器固定映射到 `data/attachments/`。上传脚本会把隐藏正文里的同类引用改写成受控 `hidden/文件名`，再映射到 `hidden/data/attachments/`。完整语法、浮层和排版保证见 [记录正文标记语法](docs/record-content-markup.md)。

## 公共 UI 与交互体系

- `frontend/src/components/ui/` 是 shadcn CLI 生成的 Base UI / Nova 组件源码，按项目约定只读。业务修改不得直接编辑这里。
- `components/archive/filter-toggle.tsx` 统一记录、人物、搜索和答题中的持久筛选：底层复用 shadcn Toggle，固定 outline variant、默认尺寸和 pressed/focus/disabled 契约。
- `SegmentedTabsList` 统一记录模式、人物记录模式、统计指标和风格顶层分区；状态仍由 shadcn Tabs 管理，共享层只绘制选中移动反馈。
- `PageHeading` + `PageHeaderProvider` 统一页面标题与响应式顶栏操作；`AsyncState` 统一 loading、empty、error、retry。
- `RecordCard`、`RecordFilters`、`ImageViewer`、`SelectionMotionLayer` 和 `interactiveSurfaceVariants` 分别统一记录、筛选、大图、选中动画与可点击业务表面。
- Button、IconButton、Select、Dialog、AlertDialog、HoverCard、Tooltip、Input、RadioGroup、Sidebar、Card、Table、ScrollArea 等都组合 shadcn 组件；业务源码不再用原生 button/input/select 复制控件状态机。
- 全局交互 token 统一 hover、pressed、focus、selected、disabled、loading、时长、缓动、阴影和 reduced-motion。具体约定见 [全站 UI 交互反馈规范](docs/ui-interaction-standard.md)。

## 工程结构

```text
.
├─ frontend/
│  ├─ public/                    # 首屏脚本、Logo、背景与 SPA fallback
│  ├─ src/
│  │  ├─ components/ui/          # 只读 shadcn Base UI 组件
│  │  ├─ components/archive/     # 可复用档案业务组件
│  │  ├─ components/layout/      # AppShell、页头、背景根层
│  │  ├─ features/auth/          # 邀请门禁与凭证生命周期
│  │  ├─ features/archive/       # 全站档案数据 Context
│  │  ├─ features/records/       # 书面页数据、映射与呈现
│  │  ├─ features/timeline/      # 时间线统计模型
│  │  ├─ features/quiz/          # 题目生成、筛选与抽样规则
│  │  ├─ hooks/                  # 异步、图片、浮层、图表交互 hooks
│  │  ├─ lib/                    # 标记、路由跳转、统计和纯工具函数
│  │  ├─ pages/                  # 路由页面
│  │  ├─ services/               # Supabase、数据、缓存和清理
│  │  ├─ styles/                 # Tailwind v4 与项目 token/业务样式
│  │  └─ types/                  # 领域类型
│  ├─ components.json            # shadcn Base UI / Nova 配置
│  └─ vite.config.ts             # Vite、React、Tailwind 与 Pages base
├─ scripts/                      # 环境检查、管理 CLI、安全与回归测试
├─ supabase/migrations/          # Supabase CLI 版本化数据库迁移
├─ supabase/rollbacks/           # 与迁移配套、需人工执行的 down SQL
├─ sql/setup.sql                 # 表、RPC、RLS、Storage policy
├─ sql/check.sql                 # 生产 Supabase 只读漂移检查
├─ docs/                         # 现行专题文档与历史审查快照
├─ private-assets/               # Git 忽略的本地私密源数据/资源
├─ .github/workflows/            # GitHub Pages 发布流程
└─ vercel.json                   # Vercel 构建、缓存、安全头与 SPA rewrite
```

添加页面时至少同步检查 `app.tsx` 的受保护白名单与 Route、`route-preload.ts`、AppShell 导航、文档和静态测试；不能只新增一个页面文件。

## 技术栈

- React 19、React DOM 19、TypeScript 7、React Router 8
- Vite 8、Tailwind CSS 4、Biome 2
- shadcn CLI 4、Base UI、class-variance-authority、tailwind-merge
- Supabase JS 2（PostgREST、RPC、Storage）与锁定版本的 Supabase CLI
- Recharts 3、Lucide React、Geist Variable Font
- Node.js 内建测试脚本；Playwright Chromium 用于 CI 强制真实布局回归

依赖版本以根 `package-lock.json` 为发布锁定来源，不应手工推断或在文档中维护另一份精确版本表。

## 本地开发

要求 Node.js `>=22.12.0`；仓库 `.nvmrc` 使用 Node 22。

```bash
nvm install
nvm use
npm ci
npm run doctor
npm run dev
```

开发地址为 `http://127.0.0.1:5173/`。如果从另一操作系统复制项目，不要复用旧 `node_modules`；删除安装目录后在当前系统重新执行 `npm ci`。

前端已经内置当前 Supabase 项目的公开 URL 与 anon key。需要连接另一项目时，在 `frontend/.env.local` 配置：

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

anon key 不是 service role 密钥，但新项目仍必须执行同一套 RLS/Storage policy。若部署到 Vercel 且更换 Supabase 域名，还必须同步更新 `vercel.json` 的 CSP `connect-src` 与 `img-src`。

## 检查、测试与构建

```bash
npm run doctor             # Node/依赖/跨平台原生包检查
npm run db:check           # 迁移顺序、命名、基线与回滚配对检查
npm run typecheck          # TypeScript project build
npm run lint               # Biome 只读检查
npm test                   # 安全、缓存、路由、正文、记录、答题、搜索等回归
npm run content:audit      # 本地档案、引用关系和私有资源完整性审计
npm run test:layout        # 真实 Chromium 正文/响应式布局回归
npm run build              # 输出 frontend/dist
npm run budget             # 检查单 chunk、CSS、总 JS 与 dist 体积预算
npm run preview            # http://127.0.0.1:4173/
npm run check              # doctor + db:check + typecheck + lint + test + build + budget
```

`npm test` 覆盖安全边界、私有图片、签名/重试、门禁、三级缓存、插图尺寸、标记 AST、记录身份与跳转、滚动边界、记录视图、答题/统计算法、搜索、尾斜杠路由和静态 UI/部署契约。`test:layout` 需要本机已有兼容 Playwright Chromium；CI 会显式安装后执行。

可选在线安全检查：

```bash
npm run verify-security-live

# 进一步验证真实普通或管理员 token、现存对象和 5 秒 signed URL 过期
CLASS_RECORD_ACCESS_TOKEN=64字符访问token npm run verify-security-live
```

不提供 token 时，脚本只验证匿名请求和伪造 token 不能读取保护表/Storage；真实普通与管理员链路仍需分别提供合法 token 才能完成。

## Supabase 初始化与本地管理

1. 新项目可在 Supabase SQL Editor 以 owner 身份完整执行 `sql/setup.sql`；受管理项目使用 `supabase/migrations/` 与 `npm run db:push`，不要重复执行基线。
2. 执行 `npm run db:check`，再执行 `sql/check.sql`，确认迁移历史、表、函数权限、RLS、private bucket 和唯一 Storage SELECT policy 没有漂移。完整流程见 [`supabase/README.md`](supabase/README.md)。
3. 复制 `.env.example` 为仓库根 `.env`，填入本地管理变量：

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=local-service-role-key
INVITE_CODE_PEPPER=long-random-secret
CLASS_RECORD_BUCKET=classrecord-private
```

`SUPABASE_SERVICE_ROLE_KEY` 和 `INVITE_CODE_PEPPER` 只允许存在于本地或受保护的运维环境，绝不能加 `VITE_` 前缀、提交到 Git、写入前端或粘贴到浏览器控制台。

### 邀请码

```bash
npm run admin -- invites generate --count 30 --expires-days 14 --note "首批邀请码"
npm run admin -- invites generate --count 1 --expires-days 7 --access-level admin --note "管理员"
npm run admin -- invites list
npm run admin -- invites check --code CR-ABCD-EFGH-2345
```

邀请码明文只在 generate 成功时输出一次；数据库只保存带 pepper 的哈希。list/check 不输出 hash 或访问 token。

### 私密内容组织

```text
private-assets/
├─ content/
│  ├─ record/*.json                 # 普通/hidden 记录
│  ├─ record/record_pages.json      # 书面页范围与图片映射
│  ├─ people/*.json                 # 人物
│  ├─ messages/<页码>.json          # 页箴言
│  ├─ page-supplements/08-02.json   # 页码-序号补充记录
│  ├─ materials/*.json              # 资料
│  ├─ quiz/lamian.json              # 管理员隐藏题
│  ├─ credits-page.json             # 致谢
│  └─ attachments/                  # 正文/附件引用的二进制文件
├─ record-pages/                    # 书面页原图
├─ quiz/                            # 隐藏题图本地源
└─ meal-map/map.png                 # 地图原图；也兼容单独的 map.PNG
```

页补充文件名必须是 `页面-编号.json`；上传脚本以文件名解析页码与排序。资料 ID 默认使用文件名去掉 `.json` 的部分，也可在 JSON 中提供业务 `id`；`sortOrder` 控制排序。详细页箴言格式见 [书面记录页箴言](docs/page-messages.md)，地图操作见 [地图部署说明](docs/meal-map-operation.md)。

### 内容治理、发布与清理

```bash
npm run content:audit
npm run admin -- publish
npm --silent run admin -- publish --json
npm run admin -- publish --confirm-publish
npm run admin -- rollback --snapshot <时间戳> --confirm-rollback
```

`content:audit` 只检查本地内容，不需要凭据；它会验证日期、唯一 ID、正文引用、书面页范围、hidden 一致性以及私有资源存在性。`publish` 默认只读取线上 schema、表和 Storage 并显示新增、更新、未变与删除差异。只有 `--confirm-publish` 会创建发布前完整快照并执行同步与清理。

正式发布会把本地完整源作为唯一清单，删除线上陈旧表行和 bucket 对象。发布前快照包含数据库 JSON、Storage 清单及每个旧二进制对象；任一对象下载失败都会在远端写入前终止。回滚命令先验证快照完整性，再为当前线上状态创建第二份安全快照，最后恢复表和 Storage。详细检查和操作边界见 [档案内容治理与发布流程](docs/content-governance-and-publishing.md)。

### 会话与限流运维

```bash
npm run admin -- sessions overview
npm run admin -- sessions list
npm run admin -- sessions revoke --id <UUID> --confirm-revoke
npm run admin -- sessions revoke-all --confirm-revoke-all
npm run admin -- attempts cleanup --confirm-cleanup
```

查询结果不包含访问 token、token hash 或来源 hash；撤销与清理都需要显式确认参数。更完整的判断标准见 [访问权限安全模型](docs/access-security-model.md)。

## 部署

Vercel 与 GitHub Pages 都是正式入口，不区分主站与预览站：它们发布同一 Git 提交、连接同一 Supabase 项目，并遵守同一邀请码和数据权限模型。GitHub Pages 的固定入口为 <https://yippeeyi.github.io/class/>；Vercel 使用项目绑定的正式域名。发布验收必须同时覆盖两个入口，任一入口不得包含私有源文件或绕过授权的数据副本。

### GitHub Pages

`.github/workflows/deploy-pages.yml` 对指向 `main` 的 PR、`main` 推送和手动触发执行 `npm ci`、doctor、typecheck、lint、Node 回归、Playwright Chromium 布局回归和 build。PR 只验证不部署；`main` 推送和手动触发会将 `frontend/dist` 部署到 Pages，并复制 `index.html` 为 `404.html` 支持 SPA 回退。Vite 根据 `GITHUB_REPOSITORY` 自动设置项目子路径，BrowserRouter 使用同一 `BASE_URL` 作为 basename。

首次部署需在仓库 `Settings → Pages → Build and deployment` 选择 GitHub Actions。

GitHub Pages 不允许仓库配置任意 HTTP 响应头，因此 `frontend/index.html` 内置 CSP 与 referrer policy，覆盖脚本、连接、图片、表单、frame、worker、object 和 base URL 等浏览器可由文档策略控制的边界。HSTS、`frame-ancestors`、nosniff、Permissions-Policy、COOP 和 Origin-Agent-Cluster 只能由托管平台作为响应头设置，Pages 入口无法与 Vercel 在这些响应头上完全等价；这项平台差异不能通过客户端脚本补偿。

### Vercel

`vercel.json` 使用根命令 `npm run build` 和输出目录 `frontend/dist`，提供：

- `/assets/*` 一年 immutable 缓存；非 hash 字体、背景、Logo 独立 30 天缓存。
- CSP、HSTS、Referrer-Policy、nosniff、Permissions-Policy、frame protection 等安全头。
- `/data/*`、书面页、题图、私有图等敏感公开路径返回 404。
- 其余路径 rewrite 到 `index.html`，由 React Router 处理。

Vercel 的响应头 CSP 与 HTML CSP 保持同一资源白名单；更换 Supabase 项目时必须同时更新两处，避免某个正式入口出现策略漂移。

## 维护约定

- 禁止直接编辑 `frontend/src/components/ui/`；通过业务组合、`className`、variant、设计 token 或公共业务组件扩展。
- 不要为了视觉重构改变记录编号、日期、人物关系、题目抽样、hidden 权限或上传数据规则。
- 不要恢复 HTML 字符串渲染、原生控件模拟、后台签名 URL 定时刷新、跨页面无关数据预取或 hidden 持久缓存。
- 新增异步操作必须同时处理 loading、disabled/aria-busy、empty、error 和可重试状态；图片失败必须有界。
- 生产数据行为以 `services/data.ts`、`features/quiz/quiz-engine.ts`、`lib/markup.ts`、SQL 与管理脚本为准；修改规则时同步更新测试和本文档。
- `.env`、`private-assets/`、邀请码、service role key、访问 token 和管理命令输出不得提交到 Git。
- 发布前至少执行 `npm run check` 和 `npm run test:layout`；CI 会为 PR 安装 Chromium 并强制执行二者。正式发布还需检查 Vercel 与 GitHub Pages 两个公开入口，并完成普通/管理员合法 token 的完整人工回归。
