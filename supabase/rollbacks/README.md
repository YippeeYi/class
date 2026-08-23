# 数据库回滚脚本

此目录保存与 `supabase/migrations/` 对应的人工审核回滚 SQL，不会被 `supabase db push` 自动执行。

- 基线迁移 `20260823000000_baseline.sql` 没有自动回滚脚本；删除整套生产结构必须通过数据库备份恢复并单独审批。
- 后续每个 `TIMESTAMP_name.sql` 必须同时新增 `TIMESTAMP_name.down.sql`。
- down 脚本只撤销该次迁移引入的结构变化，不删除业务数据，除非迁移说明明确记录备份和恢复步骤。
- 先在本地副本执行并验证，再由数据库管理员在维护窗口手工执行；执行后使用 `supabase migration repair TIMESTAMP --status reverted` 修复远端迁移历史。
