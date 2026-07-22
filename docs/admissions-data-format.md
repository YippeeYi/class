# 蹭饭图私有导入数据

正式数据保存在项目外部目录，由 `ADMISSIONS_DATA_DIR` 指定，绝不提交 Git。目录包含 `universities.json`、`admissions.json` 和 `logos/`。示例均为虚构信息。

```json
// universities.json
{"universities":[{"id":"demo-university","name":"示例大学","shortName":"示大","provinceCode":"320000","cityCode":"320100","logo":"logos/demo-university-logo.png","brandImage":"logos/demo-university-brand.png","provinceDisplayOrder":10,"displayOrder":10}]}
```

```json
// admissions.json
{"admissions":[{"personId":"demo-person-001","universityId":"demo-university","displayNameOverride":"示例同学甲","major":"示例专业"}]}
```

`provinceCode` 和 `cityCode` 是唯一需要维护的行政区字段：均填写对应 GeoJSON 要素的六码行政区代码（即 `properties.gb` 去掉 `156` 前缀；例如江苏省为 `320000`、南京市为 `320100`）。不要填写 `provinceName`、`cityName`、`longitude` 或 `latitude`；上传脚本与网页会从同一省级、市级地图自动解析名称和代表点。`personId` 必须已经存在于 `class_people.id`；每人只允许一条记录。`brandImage` 是推荐字段，内容为学校官方校徽与标准字的组合图片；地图与总图会优先使用它，`logo` 仅作为缺失时的回退。两种图片均只允许 PNG、WebP、JPEG 或已经过安全审查的 SVG，最大 2 MiB。脚本上传后分别保存为 `images/admissions/<university-id>.<ext>` 与 `images/admissions/<university-id>-brand.<ext>`。

从旧格式迁移时，先执行 `docs/supabase-admissions.sql`，再使用新的 `universities.json` 重新运行上传脚本。旧的 `provinceName`、`cityName`、`longitude`、`latitude` 不再读取；数据库中保留的旧列仅用于兼容历史迁移，不参与网页定位或数据维护。

`provinceDisplayOrder` 控制总图和网页中省份注释的上下顺序；大学数据的 `displayOrder` 控制同省学校的从上到下顺序。录取学生不使用 `displayOrder`，同一大学内始终按展示名的中文词典序排列。新增学校或调整顺序只需修改此文件，不修改页面代码。

```powershell
$env:ADMISSIONS_DATA_DIR='D:\private\class-admissions'
node scripts/migrate-secure-content.mjs --validate-only
node scripts/migrate-secure-content.mjs
node scripts/migrate-secure-content.mjs --prune --confirm-prune
```

日志只报告 ID、文件和数量，绝不会打印展示名、专业、令牌或签名 URL。
