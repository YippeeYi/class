# 编日史

这是一个面向班级内部的静态站点，前端通过 Supabase Auth、Database 和 Storage 读取记录、人物、术语、书面记录图片和互动数据。

## 重要说明

- 生产数据以 Supabase 为准；不要把 `data/` 或 `images/record-pages/` 作为 GitHub 仓库依赖。
- 记录 JSON、人物 JSON、术语 JSON、答题和书面记录页面配置都通过 `js/secureData.js` 从 Supabase 表读取。
- 记录附件和书面图片通过 Supabase Storage 签名 URL 加载，前端保留 attachment 相关逻辑。
- 项目没有新增 Service Worker；`js/imageCache.js` 和 `js/cacheLoader.js` 仅会注销旧版 `service-worker.js` 注册并清理项目缓存。

## 页面

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 登录 | `auth.html` | Supabase 登录、注册和会话恢复 |
| 导览 | `index.html` | 站点入口和数量统计 |
| 记录 | `record.html` | 记录列表、筛选、书面页、互动 |
| 人物 | `people.html`, `person.html?id=...` | 人物列表和详情 |
| 术语 | `glossary.html`, `term.html?id=...` | 术语列表和详情 |
| 扩展 | `search.html`, `timeline.html`, `quiz.html`, `achievements.html`, `shop.html` | 搜索、统计、答题、成就和背景 |
| 互动与管理 | `wall.html`, `credits.html`, `admin.html` | 留言、致谢和审核 |

## Supabase 接入

- 配置文件：`js/supabaseConfig.js`。
- 客户端封装：`js/supabaseClient.js`。
- 数据加载：`js/secureData.js`，输出 `ClassRecordData`。
- 登录门禁：`js/authGate.js`，未登录访问业务页会记录目标并跳转 `auth.html`。
- 用户状态：`js/userState.js`，用于 Q 币和成就状态持久化。

## 部署

本项目可直接以 GitHub Pages 静态站点部署。页面使用相对路径，关键 CSS/JS 引用使用固定版本参数 `v=20260625` 来避免旧缓存持续加载。

部署前请确认：

1. `docs/supabase-setup.sql` 和 `docs/supabase-secure-content.sql` 已在 Supabase SQL Editor 中按需执行。
2. Supabase Auth 中已创建需要的用户。
3. Supabase 表中的中文数据本身不存在乱码。
4. Storage 中的附件和书面记录图片路径与表数据一致。
