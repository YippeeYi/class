# Class Record

一个接入 Supabase 的班级档案前端。敏感记录、人物、名言、答题数据和图片资源都从 Supabase 读取；访问者必须先通过一次性邀请码验证，前端才会加载站点内容。

前端已整体迁移为 React 19 + TypeScript 7 单页应用，使用 React Router 8、Vite 8、Tailwind CSS v4，以及由官方 shadcn CLI 下载的 Base UI 全组件源码。原生 HTML/CSS/JS 运行时已经移除。

## 项目结构

```text
frontend/
├─ index.html          # Vite / React 入口
├─ components.json     # shadcn CLI（Base UI / Nova）配置
├─ public/             # 字体、背景、Logo 等静态资源
├─ src/
│  ├─ components/ui/   # shadcn CLI 下载的完整 Base UI 组件源码
│  ├─ components/      # 档案业务组件和应用壳层
│  ├─ features/auth/   # 邀请码门禁与访问状态
│  ├─ pages/           # React 路由页面
│  ├─ services/        # Supabase 与安全数据访问
│  └─ lib/             # 标记解析、统计与通用工具
├─ package.json        # 前端依赖与命令
├─ tsconfig*.json      # TypeScript 7 严格模式配置
├─ vite.config.ts      # React 与 Tailwind v4 插件配置
└─ biome.json          # 不受 TS 7 peer 范围限制的代码检查配置
scripts/               # 本地管理、安全验证和回归测试脚本
sql/                   # Supabase 初始化与安全检查 SQL
docs/                  # 运维和内容格式文档
private-assets/        # 本地私密源文件（Git 忽略）
```

## 当前安全模型

- 没有账号体系：没有注册、登录、用户身份表、用户 ID、管理员账号或个人中心。
- 一次性邀请码通过 Supabase RPC `verify_invite_code(input_code text)` 验证并原子作废。
- 前端不读取邀请码表，不硬编码可用邀请码。
- 验证通过后，本地只保存 `classRecord:inviteAccess` 和 `classRecord:lastVisitAt`，不保存原始邀请码；状态采用 90 天最近访问滑动有效期和 365 天绝对有效期，权限始终由服务端 token 验证决定。
- 完整的访问权限边界、撤销方式和用户注意事项见 [docs/access-security-model.md](docs/access-security-model.md)。
- 前端允许的 Supabase 交互只有邀请码验证、必要数据读取、Storage 签名 URL 和必要的只读展示请求。
- 前端不再提交评论、收藏、表情、分享、成就、Q 币、答题结果、纠错、留言或任何用户本地状态。

## 页面

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 邀请码验证 | `/auth` | 输入一次性邀请码 |
| 导览 | `/` | 站点入口和统计卡片 |
| 记录 | `/records` | 普通记录和书面记录展示 |
| 人物 | `/people`, `/person?id=...` | 人物列表和详情 |
| 名言 | `/quotes` | 名言列表，点击后定位到对应记录 |
| 搜索 | `/search` | 记录、人物、名言搜索 |
| 时间线 | `/timeline` | 档案统计视图 |
| 答题 | `/quiz` | 本地判题，不上传答题结果 |
| 资料、地图、背景、致谢 | `/materials`, `/map`, `/backgrounds`, `/credits` | 其他档案功能 |

## 关键文件

- `frontend/src/features/auth/`：统一邀请码门禁、本地候选 token 和服务端刷新。
- `frontend/src/services/supabase.ts`：Supabase 客户端配置。
- `frontend/src/services/data.ts`：记录、人物、资料、答题、书面页和 Storage 签名 URL 读取。
- `frontend/src/lib/markup.ts`：记录正文标记的安全解析、引用提取与纯文本转换。
- `frontend/src/components/ui/`：由 `npx shadcn@latest add --all` 下载的 Base UI 组件源码。
- `sql/setup.sql`：当前无账号方案的 Supabase 建表、函数、RLS 与 Storage policy SQL。
- `sql/check.sql`：Supabase 安全状态只读检查 SQL。

## 本地运行

```bash
npm install
npm run dev
```

访问：

```text
http://127.0.0.1:5173/
```

常用检查命令：

```bash
npm run typecheck
npm run lint
npm test
npm run build
# 或一次运行全部检查
npm run check
```

## GitHub Pages 部署

仓库包含 [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)。推送到 `main` 分支或手动运行该 workflow 后，它会安装依赖、执行类型检查、lint、测试和生产构建，并将 `frontend/dist` 部署到 GitHub Pages。

首次使用时，在仓库 `Settings → Pages → Build and deployment` 中将 Source 设置为 `GitHub Actions`。Vite 会在 Actions 中根据 `GITHUB_REPOSITORY` 自动设置项目路径，React Router 和静态资源也会使用对应的 `basename` 与 base URL。

## 记录正文跳转标记

记录 JSON 的 `content` 可使用 `[[record:文件名|显示文字]]` 创建记录跳转。例如：

```text
参见 [[record:2025-01-06-01|这条记录]]。
```

文件名可带或不带 `.json`。点击后会通过 React Router 进入记录页，并使用查询参数定位目标记录。

正文也支持行内分式 `[[frac:上方文字|下方文字]]`，以及悬浮或点击显示说明的注解
`[[anno:注解内容|被注释文字]]`。格式不完整的标记会安全地按原文显示。

项目内附件插图可使用 `[[illu:data/attachments/example.png|被标记文字]]`。悬浮、键盘聚焦或
触屏点击被标记文字时会显示图片预览；路径仅允许附件目录中的常见图片格式。

删除线使用 `[[del:被删除文字]]`，正文会保留文字并以内联删除线显示。

下划线使用 `[[under:被标记文字]]`，标红使用 `[[red:被标记文字]]`；两者均支持递归嵌套其他正文标记。

上述 `[[...]]` 标记使用平衡括号递归解析为类型化 AST，参数中的嵌套标记会继续渲染；
普通文本直接作为 React 文本节点输出，不拼接 HTML 字符串。插图路径严格限制在
`data/attachments/` 目录。

注解内容同样支持人物、名言、跳转及文字样式标记；注解或插图的二次悬浮标记会在浮层中
安全降级为标签文字。注解与插图浮层均支持移入停留，并在离开触发文字和浮层后延迟关闭。

## Supabase 邀请码设置

完整设置 SQL 见 `sql/setup.sql`，安全检查 SQL 见 `sql/check.sql`。核心机制：数据库只保存 `invite_codes.code_hash`，前端提交邀请码后由 RPC 在数据库端读取私有配置表 `invite_code_settings` 中的 pepper 计算 hash，并在同一个 `update ... returning` 操作中把邀请码标记为已使用。

本地生成邀请码：

```bash
npm install
npm run admin -- invites generate --count 30 --expires-days 14 --note "G2-1 首批邀请码"
# 仅在需要访问 hidden 内容时生成高权限邀请码
npm run admin -- invites generate --count 1 --expires-days 7 --access-level admin --note "管理员隐藏内容访问"
```

统一管理入口为 `scripts/admin.mjs`：

```bash
# 预检查或上传全部私密内容
npm run admin -- upload --dry-run
npm run admin -- upload

# 查看全部邀请码的状态；不会显示邀请码明文或哈希
npm run admin -- invites list

# 用邀请码明文检查这一张是否已使用、过期或不存在；不会回显输入内容
npm run admin -- invites check --code CR-ABCD-EFGH-2345
```

邀请码只会在 `invites generate` 成功时输出一次；数据库仅保存加 pepper 的哈希。请立即在安全位置保存生成结果，不要把邀请码、`.env` 或命令输出提交到 Git。

本地 `.env` 需要包含：

```text
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的 service role key，仅本地使用
INVITE_CODE_PEPPER=请填写一段足够长的随机字符串
```

`SUPABASE_SERVICE_ROLE_KEY` 和 `INVITE_CODE_PEPPER` 只用于本地管理脚本，绝不能进入前端代码。

## 数据与图片

前端不依赖本地 `private-assets/`。记录、人物、名言、答题和书面记录页来自 Supabase 表；图片和附件通过 Supabase Storage 签名 URL 加载。

正式上传脚本只会上传数据库行实际引用、且位于白名单根目录中的二进制资源，不会把 `private-assets/content/**/*.json` 上传到 Storage。Quiz 原图仅保存在本机被 Git 忽略的 `private-assets/quiz/` 下，迁移后对应对象路径仍为 `images/quiz/`。需要同步清理远端失效文件时，先 dry-run，再使用：

```bash
npm run admin -- upload --prune --confirm-prune
```

`--prune` 会以本次数据库导入实际生成的资源清单为准清理整个专用 bucket；请仅将 `classrecord-private` 用于本网站，并在执行前保留必要备份。

`lamian` 隐藏题及其 `images/quiz/` 题图仅对管理员邀请码会话开放。普通邀请码不会预加载隐藏题，敲击 `lamian` 也不会触发解锁。

## 第二阶段安全参数

- 普通 Storage signed URL 有效期为 600 秒；`hidden/` 和 `images/quiz/` 为 180 秒。URL 只保存在页面内存，不写入 Web Storage，并在页面退出或权限清理时清空。
- 邀请访问保持 90 天闲置滑动体验，但服务端会在首次授权 365 天后强制重新验证。浏览器中的本地状态只用于找到候选 token，页面放行始终需要 Supabase 刷新成功。
- `verify_invite_code()` 同时按代理提供的来源 IP、被尝试的邀请码和全站请求量限流。历史清理由 `cleanup_invite_code_attempts()` 独立执行，建议在 Supabase Cron 中每天调用一次：`select public.cleanup_invite_code_attempts();`。
- 初始搭建与环境检查只使用 `sql/setup.sql` 和 `sql/check.sql`。

## 书面记录页内补充记录

补充记录文件单独放在 `private-assets/content/page-supplements/`，不要放进 `private-assets/content/record/`。

文件命名保持 `页面-编号.json`，例如 `08-02.json`。字段只需要：

```json
{
  "author": "记录人ID",
  "content": "补充记录内容"
}
```

上传脚本会把这些文件导入 `class_page_supplements`，前端只会在书面记录模式的对应页码中显示；它们不会进入普通记录列表、搜索、人物页、名言跳转或统计。

## 资料数据

资料文件单独放在 `private-assets/content/materials/`。

文件名建议使用稳定的英文、数字、短横线或下划线，例如：

```text
exam-rules.json
chemistry-notes.json
```

上传脚本会使用文件名去掉 `.json` 后的部分作为默认资料 ID。每个 JSON 至少包含：

```json
{
  "title": "资料标题",
  "content": "资料解释内容"
}
```

可选字段：

- `id`：资料唯一标识；不填时使用文件名。
- `sortOrder`：排序序号；不填时按文件名扫描顺序。

`content` 支持现有记录正文标记语法，例如人物、名言、插图、注释、黑幕、上下标、删除线和标红。
