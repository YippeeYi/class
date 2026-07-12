# Class Record

一个接入 Supabase 的班级档案前端。敏感记录、人物、名言、答题数据和图片资源都从 Supabase 读取；访问者必须先通过一次性邀请码验证，前端才会加载站点内容。

## 当前安全模型

- 没有账号体系：没有注册、登录、用户身份表、用户 ID、管理员账号或个人中心。
- 一次性邀请码通过 Supabase RPC `verify_invite_code(input_code text)` 验证并原子作废。
- 前端不读取邀请码表，不硬编码可用邀请码。
- 验证通过后，本地只保存 `classRecord:inviteAccess` 和 `classRecord:lastVisitAt`，不保存原始邀请码；状态采用 30 天最近访问滑动有效期。
- 前端允许的 Supabase 交互只有邀请码验证、必要数据读取、Storage 签名 URL 和必要的只读展示请求。
- 前端不再提交评论、收藏、表情、分享、成就、Q 币、答题结果、纠错、留言或任何用户本地状态。

## 页面

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 邀请码验证 | `auth.html` | 输入一次性邀请码 |
| 导览 | `index.html` | 站点入口和统计卡片 |
| 记录 | `record.html` | 普通记录和书面记录展示 |
| 人物 | `people.html`, `person.html` | 人物列表和详情 |
| 名言 | `quotes.html` | 名言列表，点击后定位到对应记录 |
| 搜索 | `search.html` | 记录、人物、名言搜索 |
| 时间线 | `timeline.html` | 档案统计视图 |
| 答题 | `quiz.html` | 本地判题，不上传答题结果 |
| 背景 | `shop.html` | 本地背景切换，不写入服务器 |

## 关键文件

- `js/authGate.js`：统一邀请码门禁和本地验证状态管理。
- `js/authPage.js`：邀请码输入页逻辑。
- `js/supabaseClient.js`：Supabase 客户端与 `verify_invite_code` RPC。
- `js/secureData.js`：记录、人物、名言、答题、书面页和 Storage 签名 URL 读取。
- `js/recordStore.js`、`js/peopleStore.js`、`js/quoteStore.js`：运行时只读数据仓库。
- `js/recordRenderer.js`：记录正文、人物链接、名言链接、隐藏内容、上下标和附件展示。
- `docs/supabase-setup.sql`：当前无账号方案的 Supabase 建表、函数、RLS 与 Storage policy SQL。
- `docs/supabase-security-check.sql`：Supabase 安全状态只读检查 SQL。

## 本地运行

```bash
python -m http.server 8000
```

访问：

```text
http://localhost:8000/index.html
```

## 记录正文跳转标记

记录 JSON 的 `content` 可使用 `[[record:文件名|显示文字]]` 创建记录跳转。例如：

```text
参见 [[record:2025-01-06-01|这条记录]]。
```

文件名可带或不带 `.json`。点击后会复用记录页现有的平滑滚动与高亮动画；书面记录模式会保持书面模式并定位到目标所在页，其他页面或按条模式会进入按条记录。定位完成后，目标记录旁会提供“留在这里”和“返回原位置”操作。

正文也支持行内分式 `[[frac:上方文字|下方文字]]`，以及悬浮或点击显示说明的注解
`[[anno:注解内容|被注释文字]]`。格式不完整的标记会安全地按原文显示。

项目内附件插图可使用 `[[illu:data/attachments/example.png|被标记文字]]`。悬浮、键盘聚焦或
触屏点击被标记文字时会显示图片预览；路径仅允许附件目录中的常见图片格式。

删除线使用 `[[del:被删除文字]]`，正文会保留文字并以内联删除线显示。

下划线使用 `[[under:被标记文字]]`，标红使用 `[[red:被标记文字]]`；两者均支持递归嵌套其他正文标记。

上述 `[[...]]` 标记使用平衡括号递归解析，参数中的嵌套标记会继续渲染；普通文本默认进行
HTML 转义。插图路径严格限制在 `data/attachments/` 目录。

注解内容同样支持人物、名言、跳转及文字样式标记；注解或插图的二次悬浮标记会在浮层中
安全降级为标签文字。注解与插图浮层均支持移入停留，并在离开触发文字和浮层后延迟关闭。

## Supabase 邀请码设置

完整设置 SQL 见 `docs/supabase-setup.sql`，安全检查 SQL 见 `docs/supabase-security-check.sql`。核心机制：数据库只保存 `invite_codes.code_hash`，前端提交邀请码后由 RPC 在数据库端读取私有配置表 `invite_code_settings` 中的 pepper 计算 hash，并在同一个 `update ... returning` 操作中把邀请码标记为已使用。

本地生成邀请码：

```bash
npm install
node scripts/generate-invite-codes.mjs --count 30 --expires-days 14 --note "G2-1 首批邀请码"
# 仅在需要访问 hidden 内容时生成高权限邀请码
node scripts/generate-invite-codes.mjs --count 1 --expires-days 7 --access-level admin --note "管理员隐藏内容访问"
```

本地 `.env` 需要包含：

```text
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的 service role key，仅本地使用
INVITE_CODE_PEPPER=请填写一段足够长的随机字符串
```

`SUPABASE_SERVICE_ROLE_KEY` 和 `INVITE_CODE_PEPPER` 只用于本地管理脚本，绝不能进入前端代码。

## 数据与图片

前端不依赖本地 `data/` 或 `images/record-pages/`。记录、人物、名言、答题和书面记录页来自 Supabase 表；图片和附件通过 Supabase Storage 签名 URL 加载。

## 书面记录页内补充记录

补充记录文件单独放在 `data/page-supplements/`，不要放进 `data/record/`。

文件命名保持 `页面-编号.json`，例如 `08-02.json`。字段只需要：

```json
{
  "author": "记录人ID",
  "content": "补充记录内容"
}
```

上传脚本会把这些文件导入 `class_page_supplements`，前端只会在书面记录模式的对应页码中显示；它们不会进入普通记录列表、搜索、人物页、名言跳转或统计。

## 资料数据

资料文件单独放在 `data/materials/`。

文件名建议使用稳定的英文、数字、短横线或下划线，例如：

```text
school-map.json
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
