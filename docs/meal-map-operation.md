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

将变量写入仓库根目录的 `.env`，或仅在当前终端会话中设置（不要提交到 Git）：

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
CLASS_RECORD_BUCKET=classrecord-private
```

`SUPABASE_SERVICE_ROLE_KEY` 只供 Node 上传/迁移脚本使用，绝不能放进 `frontend/src/`、HTML、浏览器环境变量或部署配置。

## 发布步骤

1. 将原图置于 `private-assets/meal-map/map.png`（也兼容 `map.PNG`；两者不能同时存在）。
2. 确认私密目录被 Git 忽略：`git check-ignore -v private-assets/meal-map/map.png`。
3. 保存 `.env` 或加载上述本地环境变量后，先审计并查看只读差异：

   ```bash
   npm run content:audit
   npm run admin -- publish
   ```

4. 备份 `private-assets/` 并确认差异后执行：

   ```bash
   npm run admin -- publish --confirm-publish
   ```

   脚本校验 PNG 签名与尺寸，以 `image/png` 和 `private, max-age=180` 上传，并使用 upsert 覆盖同一私有对象；然后更新无路径的元数据行。它不会输出密钥或 URL。完整发布会把蹭饭图列入清单，不会把它当成陈旧对象删除。发布前快照不包含旧图片字节，详细备份和回退要求见 [档案内容治理与发布流程](content-governance-and-publishing.md)。

## 缓存与失效

- 结构化内容：`loadCached` 会合并同一授权范围、同一 key 的在途请求；默认依次查询内存、15 分钟
  `sessionStorage` 和 IndexedDB（24 小时新鲜、7 天 stale）。网络失败时仅回退到同一授权范围内仍在 stale
  窗口的持久数据；隐藏数据和隐藏题不落入持久缓存。授权清除会清空这些缓存。
- 私有签名 URL：只在内存中保存，普通资源最长 600 秒；隐藏题和蹭饭图最长 180 秒。经过寿命约 80% 后不再命中签名缓存，由下一次实际加载或失败恢复按需重签，不用后台定时器替换已解码图片。
  退出页面、清除访问权限或 bfcache 恢复均清空 URL 与预加载结果。页面不会将 URL 写入 localStorage/sessionStorage。
- 图片：浏览器原生 HTTP 缓存负责已解码 URL 的重复使用；当前页面图片高优先级、相邻/候选图片空闲预热，不会在首页下载全部高清图。

已撤销的会话会在下一次 auth gate 刷新时被拒绝并清理所有缓存；已经签出的 URL 最多再有效 180 秒，这是纯静态前端 +
Storage signed URL 架构不可主动收回的时间上限。

## 确认未公开

```bash
git ls-files --error-unmatch private-assets/meal-map/map.png
git ls-files --error-unmatch map.PNG
rg -n -i "map\.png|map\.PNG" --glob '!node_modules/**' --glob '!docs/meal-map-operation.md' .
```

前两条应失败（退出码非零）；第三条不应在 HTML、前端页面脚本、部署产物中找到原图引用。再运行
`npm test`，其中的安全边界测试会检查忽略规则、Git 候选文件和公开目录。最后在 Supabase 的 Storage 页面确认 bucket
`classrecord-private` 的 Public 标志为关闭，并以未带 `x-class-record-access` 的请求验证无法读取或签发对象。
