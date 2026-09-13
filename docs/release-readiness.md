# 发布收尾验收（2026-09-13）

## 功能与清理

- 记录 annotation 已从 Dialog 改为非模态 shadcn Popover。保留完整 MarkupContent、滚动阅读、嵌套注解/图片/表格/人物及记录跳转；支持按钮切换、外部点击、ESC、关闭按钮、锚点滚动关闭和移动端碰撞避让，无蒙版和背景模糊。
- `/qb` 复用正式 AccessGate 与私有图片加载逻辑，没有正常页面入口。图片未提供时显示统一空状态，不请求缺失资源。
- 前端和内容发布脚本共用 `qb-asset.json`；启用后将图片纳入正式资源审查、上传、快照和保留清单，避免后续发布误删。
- 主页、致谢遗留卡片及主页 label 改用 shadcn Card/Label；标记和图例的任意圆角改为 radius token；标红使用主题 destructive token，保留深色可读性。装饰性媒体与正文结构保留其业务语义。
- 删除记录注释的旧 Dialog 实现、旧背景存储兼容读取、重复的 CI 404 复制步骤，修正文档中已不存在的方框风格选项。所有业务 TypeScript 模块均可从正式入口追踪到，没有发现可确定删除的孤立业务模块。
- `frontend/src/components/ui` 全程未修改。已有语法、排序、隐藏模式、题目抽样、文案和图片查看器动画未重新设计。

## 修复的问题

- 移动侧栏打开后立即关闭：将路由关闭逻辑移出随 Sheet 打开的子树，置于持续挂载的 SidebarProvider 下。
- 已打开页面不能及时发现凭证失效：共用 AuthProvider 增加可见页每分钟、重新可见、跨标签页凭证变更复验；旧请求不能覆盖已清理或已切换的凭证。
- Pages 深层页面依赖 HTTP 404：构建从统一路由表生成每条正式路由的空 HTML 入口，同时保留未知路径 fallback。尾斜杠下的统计布局、导航状态和记录滚动判断同步规范化。
- Vite config 的无扩展名导入 warning：改为显式 `.ts` 导入和对应 TypeScript 配置，不屏蔽 warning。

## 执行的验收

- `npm run check`：环境、5 个数据库迁移、内容审查、TypeScript、Biome、全部 Node 回归、正式 build、bundle budget 通过。
- 内容审查：0 error、0 warning；651 条记录、105 个人物、83 个书面页、75 条箴言、16 条补充、13 篇资料、164 个资源。
- `npm run test:layout`：320/390/768/1280 CSS 像素，1.25×/2× DPR；标记排版、表格、图片查看器、主题、控件与既定动画通过。
- `npm run test:app`：开发与 `/class/` 正式构建浏览器回归通过；涵盖普通/管理员门禁、记录双模式与排序、注释嵌套内容、手机侧栏、主要页面、QB 回跳/刷新/历史返回、撤销与退出。模拟图片只存在于测试浏览器，验证 QB 原比例展示及视口边界。
- `npm run test:pages`：严格静态文件服务器验证 `/class/qb` 目录跳转、查询参数保留、刷新、全部正式路径入口、公共资源及未知路径 404；已接入 GitHub Actions。
- `scripts/test-live-release.mjs`：使用专用临时普通/管理员邀请码，连接真实 Supabase 验证登录、QB 回跳/刷新、角色 RPC、主要页面、过期、撤销及访问清理。调用现有 `verify-live-security.mjs` 验证匿名/伪造凭证、普通/管理员数据权限、私有对象直接读取/签名与签名到期。测试凭证在 finally 中定向清理，不改动既有用户或档案。
- 最终差异检查无空白错误，业务源代码无原生表单控件重复实现、无任意 Tailwind 圆角值；只读 UI 目录无差异。

## 发布状态与唯一待提供资源

代码及部署构建已整理为可发布状态，未执行 Git 推送或线上部署。实际线上站点仍需由现有发布流程部署本次提交后更新。

唯一待提供资源：QB 图片。固定本地位置 `private-assets/content/attachments/qb.png`，私有 Storage 路径 `classrecord-private/data/attachments/qb.png`。当前 `ready=false` 的占位版本可构建和访问。图片接入说明见 [QB 图片接入](qb-image-operation.md)。

权限边界保持现有设计：普通图片签名最长有效 600 秒，撤销会阻止新请求，但无法追回已下载内容或立即作废已经签发的 URL；前端在复验发现失效后移除内容。这不是 QB 新增的公开访问路径。
