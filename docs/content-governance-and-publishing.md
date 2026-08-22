# 档案内容治理与发布流程

这套流程把“检查内容”和“写入线上”分开。默认命令全部只读；只有明确加入
`--confirm-publish` 才会修改 Supabase。发布以 `private-assets/` 中的完整本地源为准，
会同步数据库行和专用私有 Storage，不适合只发布单个文件。

## 1. 本地内容审计

```bash
npm run content:audit
# 需要给自动化工具读取时：
npm --silent run admin -- audit --json
```

审计不需要 Supabase 凭据，也不会访问网络。它会检查：

- 记录文件名、ID、真实日历日期、正文和重复项；
- 人物、资料的必填字段和重复 ID；
- 记录、资料、人物、名言标记的引用关系；
- 书面页起止记录、页补充映射和 `hidden` 规范列一致性；
- 所有被引用私有资源是否存在、路径是否越界或超出白名单；
- 本次完整发布的表、记录、人物、页、资料、名言和资源数量。

`ERROR` 会阻止发布；`WARN` 需要人工确认，但不会在没有内容编辑授权时自动补写或猜测档案。

## 2. 只读线上差异预览

```bash
npm run admin -- publish
# 精简的机器可读结果：
npm --silent run admin -- publish --json
```

该命令会先通过本地审计和线上 schema 校验，再比较本地发布清单与线上数据库、
Storage 清单。输出分别列出数据库的 add/update/unchanged/remove，以及 Storage 的
add/upload-existing/remove。预览不会写表、上传对象或删除内容。

`upload-existing` 表示正式发布时会重新上传已经存在且仍被引用的对象；它不是内容差异判断。
正式发布前必须逐项确认新增、更新和删除数量符合预期。出现意外删除时停止，不要使用确认参数。

## 3. 正式发布

发布前先完成以下事项：

1. 备份整个 `private-assets/` 到仓库外的受保护位置，或确认它已有可靠版本历史。
2. 在生产项目执行 `sql/check.sql`，确认所有结果为 `PASS`。
3. 保存只读差异预览，并由维护者确认其中的 add/update/remove。
4. 执行项目检查：`npm run check`。

确认后执行：

```bash
npm run admin -- publish --confirm-publish
```

脚本会再次审计和读取线上状态，先在
`private-exports/publish-snapshots/<时间>/` 创建发布前快照，再上传资源、写入表行，最后删除清单外的旧表行和旧对象。
快照目录受 Git 忽略，包含线上数据库 JSON、Storage 路径清单和本次差异。

快照不包含 Storage 二进制文件本身。被同路径覆盖的旧二进制内容只能从发布前保存的
`private-assets/` 备份、对象版本控制或其他外部备份恢复，因此缺少二进制备份时不得确认发布。

## 4. 发布后验证与回退

发布后至少验证普通和管理员两类会话：记录列表、书面页、图片/附件、资料、地图和隐藏内容权限。
随后重新运行 `npm run admin -- publish`，数据库应全部为 unchanged，Storage 不应出现 add/remove。

发现问题时立即停止继续发布：

- 使用快照中的表 JSON 对照并恢复线上结构化数据；
- 使用发布前的受保护二进制备份恢复被覆盖或删除的对象；
- 恢复后重新执行本地审计、`sql/check.sql` 和只读差异预览；
- 若怀疑访问凭证泄露，使用会话撤销命令，不要把 token 或 hash 写入工单。

当前 CLI 不提供一键回滚，以免在没有核对快照和二进制备份时再次覆盖生产数据。

## 5. 会话与限流运维

```bash
npm run admin -- sessions overview
npm run admin -- sessions list
npm run admin -- sessions revoke --id <UUID> --confirm-revoke
npm run admin -- sessions revoke-all --confirm-revoke-all
npm run admin -- attempts cleanup --confirm-cleanup
```

只读会话命令不输出访问 token、token hash 或来源 hash。撤销和清理都要求独立确认参数。
限流器打开后不再为同一批已拒绝请求追加记录，避免恶意流量把限流表本身变成写放大路径；
过期尝试记录由显式 cleanup 命令清理。

## 6. 兼容命令

`upload`、`--dry-run` 和显式 `--prune --confirm-prune` 仍保留给底层诊断及旧流程，
但日常完整档案发布统一使用 `audit` → `publish` → `publish --confirm-publish`，以保证差异预览、发布前快照和删除确认不会被跳过。
