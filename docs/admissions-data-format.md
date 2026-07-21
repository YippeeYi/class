# 蹭饭图私有导入数据

正式数据保存在项目外部目录，由 `ADMISSIONS_DATA_DIR` 指定，绝不提交 Git。目录包含 `universities.json`、`admissions.json` 和 `logos/`。示例均为虚构信息。

```json
// universities.json
{"universities":[{"id":"demo-university","name":"示例大学","shortName":"示大","provinceCode":"320000","provinceName":"江苏省","cityName":"南京市","longitude":118.796,"latitude":32.060,"logo":"logos/demo-university.png","displayOrder":10}]}
```

```json
// admissions.json
{"admissions":[{"personId":"demo-person-001","universityId":"demo-university","displayNameOverride":"示例同学甲","major":"示例专业","displayOrder":10}]}
```

`personId` 必须已经存在于 `class_people.id`；每人只允许一条记录。Logo 只允许 PNG、WebP、JPEG 或已经过安全审查的 SVG，最大 2 MiB。脚本上传后，远端路径为 `images/admissions/<university-id>.<ext>`。

```powershell
$env:ADMISSIONS_DATA_DIR='D:\private\class-admissions'
node scripts/migrate-secure-content.mjs --validate-only
node scripts/migrate-secure-content.mjs
node scripts/migrate-secure-content.mjs --prune --confirm-prune
```

日志只报告 ID、文件和数量，绝不会打印展示名、专业、令牌或签名 URL。
