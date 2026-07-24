# 蹭饭图：部署与安全操作

## 一次性 SQL

在 Supabase SQL Editor 以项目 owner 身份完整执行 `sql/setup.sql`，随后执行
`sql/check.sql`。前者会重复安全地创建 `class_private_assets` 元数据表、将
`classrecord-private` 保持为非公开 bucket，并把 `images/private/meal-map.png` 纳入唯一的、受
`has_class_record_access()` 保护的 Storage SELECT policy。元数据表只保存逻辑键、像素尺寸和更新时间；
不保存对象路径、图片内容或签名 URL。

已有数据库仍应使用完整
setup SQL 来创建元数据表与其 RLS policy。

## 本地环境变量

仅在本机终端设置（不要提交到 Git）：

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
CLASS_RECORD_BUCKET=classrecord-private
```

`SUPABASE_SERVICE_ROLE_KEY` 只供 Node 上传/迁移脚本使用，绝不能放进 `js/`、HTML、浏览器环境变量或部署配置。

## 上传步骤

1. 将原图置于 `private-assets/meal-map/map.png`（也兼容 `map.PNG`；两者不能同时存在）。
2. 确认私密目录被 Git 忽略：`git check-ignore -v private-assets/meal-map/map.png`。
3. 加载上述本地环境变量后执行：

   ```powershell
   npm run upload-private-content
   ```

   脚本校验 PNG 签名与尺寸，以 `image/png` 和 `private, max-age=180` 上传，并使用 upsert 覆盖同一私有对象；
   然后更新无路径的元数据行。它不会输出密钥、对象路径或 URL。

4. 完整内容迁移也会处理该图：

   ```powershell
   npm run upload-private-content
   ```

   迁移的 `--prune` 模式会把蹭饭图列为保护对象，不会因为它不属于普通内容清单而删除它。

## 缓存与失效

- 结构化内容：`loadWithCache` 在同一页面生命周期内按键复用同一个 Promise，并保留内存结果；会话缓存的版本为
  `classRecord:dataCache:v1`、TTL 为 10 分钟。授权清除、授权刷新失败和 bfcache 恢复都会清空它，失败请求不会写入缓存。
- 私有签名 URL：只在内存中保存，普通资源最长 600 秒；隐藏题和蹭饭图最长 180 秒，并在到期前约 20% 的缓冲窗口刷新。
  退出页面、清除访问权限或 bfcache 恢复均清空 URL 与预加载结果。页面不会将 URL 写入 localStorage/sessionStorage。
- 图片：浏览器原生 HTTP 缓存负责已解码 URL 的重复使用；当前页面图片高优先级、相邻/候选图片空闲预热，不会在首页下载全部高清图。

已撤销的会话会在下一次 auth gate 刷新时被拒绝并清理所有缓存；已经签出的 URL 最多再有效 180 秒，这是纯静态前端 +
Storage signed URL 架构不可主动收回的时间上限。

## 确认未公开

```powershell
git ls-files --error-unmatch private-assets/meal-map/map.png
git ls-files --error-unmatch map.PNG
rg -n -i "map\.png|map\.PNG" --glob '!node_modules/**' --glob '!docs/meal-map-operation.md' .
```

前两条应失败（退出码非零）；第三条不应在 HTML、前端页面脚本、部署产物中找到原图引用。再运行
`npm test`，其中的安全边界测试会检查忽略规则、Git 候选文件和公开目录。最后在 Supabase 的 Storage 页面确认 bucket
`classrecord-private` 的 Public 标志为关闭，并以未带 `x-class-record-access` 的请求验证无法读取或签发对象。
