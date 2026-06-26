# Supabase SQL 执行说明

## 执行顺序

1. 打开 Supabase 项目后台。
2. 进入 **SQL Editor**。
3. 新建 Query，完整复制并执行 `docs/supabase-setup.sql`。
4. 看到执行成功后，再打开 `docs/supabase-key-operations.sql`。
5. 在第一段 `Add the first key` 中，把 `REPLACE_WITH_YOUR_SITE_KEY` 改成你要使用的统一密钥。
6. 只执行第一段新增密钥 SQL。
7. 回到网站密钥页，输入刚设置的密钥。

## 如果仍然看到 RPC 404

先在 SQL Editor 执行：

```sql
notify pgrst, 'reload schema';
```

然后等待几十秒，刷新密钥页再试。

如果仍然 404，执行 `docs/supabase-rpc-diagnostics.sql`。重点看：

- 第 1 段是否返回 `public.verify_site_key(input_key text)`。
- 第 2 段 `anon_can_execute` 是否为 `true`。
- 第 4 段直接调用正确密钥是否返回 `true`。

如果第 1 段没有返回任何行，说明 `docs/supabase-setup.sql` 没有成功执行到创建 RPC 的部分，需要重新执行主脚本。

## 新增密钥

在 `docs/supabase-key-operations.sql` 中执行第 2 段 `Add a new key before switching users to it`，把占位符替换成新密钥。

## 更换密钥

1. 先执行第 2 段新增新密钥。
2. 确认新密钥能进入网站。
3. 再执行第 3 段停用旧密钥。

## 停用旧密钥

执行第 3 段 `Disable an old key`，按 `label` 停用旧密钥。

## 忘记密钥

执行第 4 段 `Reset when the key is forgotten`：

1. 停用所有 active key。
2. 插入一个新的 reset key。

## 前端实际会做什么

- 前端只调用 `verify_site_key(input_key text)` RPC。
- RPC 只返回 `true` 或 `false`。
- 前端不会读取 `site_access_keys` 表。
- 前端不会保存原始密钥。
- 本地只保存 `classRecordSiteKeyVerified.v1` 这个已验证状态。
