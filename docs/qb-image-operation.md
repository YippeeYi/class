# QB 图片接入

`https://yippeeyi.github.io/class/qb` 是仅 URL 可达的受保护路由，不加入导航、主页或搜索索引。页面沿用站点 title 和认证回跳，面包屑显示 QB。

唯一待提供资源是图片。固定本地源位置：`private-assets/content/attachments/qb.png`（已被 Git 忽略）。固定私有对象位置：`classrecord-private/data/attachments/qb.png`。请勿放入 `frontend/public` 或提交图片到 Git。

图片提供后，将 `frontend/src/lib/qb-asset.json` 的 `ready` 改为 `true`，运行现有 `npm run content:audit` 和 `npm run content:plan` 检查发布计划，再按正式内容发布流程上传。管理脚本和前端读取同一份配置：图片会纳入缺失检查、上传、快照及保留清单，不会被下一次内容发布误删。上传完成后再发布前端。默认 `ready=false` 不访问不存在的对象，显示统一空状态。

前端只通过原有 `useSignedAsset`、`useBoundedImageRetry` 和私有 Storage RLS 获取图片，保留 loading/error/手动重试；按原比例缩小到视口内，小图保持自然尺寸。普通与管理员均可读，匿名及无效凭证不能签发访问地址。

安全边界沿用现有全站模型：服务端在数据读取与签名时复验凭证；已签发普通图片 URL 最长有效 600 秒，撤销不会追回已经下载的内容或立即使旧签名失效。前端可见页每分钟及重新可见时复验，发现失效立即清理凭证并返回认证。此页面没有第二套认证或公开图片副本。

Pages 构建会输出 `/qb/index.html`（只有通用空应用壳），由目录重定向解析无尾斜杠 URL；查询参数保留。`npm run test:pages` 须在 `GITHUB_ACTIONS=true GITHUB_REPOSITORY=yippeeyi/class npm run build` 后运行。
