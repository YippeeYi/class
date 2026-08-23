# Supabase 数据库迁移

`supabase/migrations/` 是数据库结构变更历史，使用 Supabase CLI 的 14 位 UTC 时间戳命名。`sql/setup.sql` 保留为全新项目的一次性完整初始化脚本；新增迁移时必须同步更新它，使两条建库路径最终得到相同结构。

## 日常流程

```bash
npm run db:new -- concise_change_name
# 编辑 supabase/migrations/<timestamp>_concise_change_name.sql
# 新增 supabase/rollbacks/<timestamp>_concise_change_name.down.sql
npm run db:check
npm run db:reset
```

本地验证通过后，先由 Supabase 建立数据库备份，再执行：

```bash
supabase link --project-ref <project-ref>
npm run db:push -- --dry-run
npm run db:push
```

若现有生产项目已经完整执行过 `sql/setup.sql`，不要再次推送基线。先运行 `sql/check.sql` 确认结构无漂移，再执行 `supabase migration repair 20260823000000 --status applied` 将当前结构登记为基线；随后用 `supabase migration list` 确认本地与远端历史一致。

已经应用的迁移文件不可修改或重命名；修复只能新增后续迁移。若必须回退，先执行对应 `.down.sql` 并验证，再运行 `supabase migration repair <timestamp> --status reverted`。`migration repair` 只修复历史状态，不代替实际回滚 SQL。
