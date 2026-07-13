# 《当前访问权限安全模型说明》

## 1. 当前安全架构

网站没有账号体系。一次性邀请码只用于兑换一个 256 位随机访问 token；邀请码消费与 session 创建在同一个数据库事务内完成。浏览器只收到这一次生成的原始 token，数据库只保存加入服务端 pepper 后的 SHA-256 哈希，因此仅泄露数据库中的 session 表不能直接还原可用 token。

每个请求都把 token 放在自定义请求头 `x-class-record-access` 中。Database RLS、Storage policy 和签名 URL 创建均在服务端重新验证 token；修改 `localStorage` 中的本地状态不能产生权限。普通 token 只能读取普通资源，管理员 token 才能读取隐藏记录、隐藏书面页和 Quiz 彩蛋。

session 同时受以下条件约束：90 天未使用失效、`expires_at` 绝对到期（创建后 365 天）、`revoked_at` 撤销后立即拒绝。刷新只能更新仍处于有效期内且未撤销的 session，不能重新激活过期或撤销的 token。

## 2. 为什么不绑定 IP 或设备

班级成员会在校园网、家庭网络和移动网络之间切换，NAT、IPv6 临时地址和运营商出口也会变化。强制 IP/设备绑定会产生大量误封，并引入额外的个人信息收集，不符合本站“不上传个人信息”的原则。

系统只保存经过 pepper 哈希的最近请求来源指纹，用于识别五分钟内快速切换来源的异常；不保存原始 IP、地区或 User-Agent，也不会因该标记自动阻断访问。

## 3. token 泄露后的影响范围

token 是 bearer credential：攻击者取得原始 token 后，可以在另一台设备上以该 session 的权限访问，直到 session 到期或管理员撤销。普通 token 不具备写入、管理或隐藏 Quiz 权限；管理员 token 的泄露影响更大，应更谨慎保管。

撤销会令所有新的数据库读取、Storage 列举和签名请求立即失败。撤销前已经生成的 signed URL 不会被 Supabase 主动收回，但只会持续到其自身到期：当前普通资源最长 600 秒，敏感资源最长 180 秒。

## 4. 当前防护措施

- token 使用 32 字节密码学随机数生成，原始值仅返回一次。
- 数据库仅保存带 pepper 的哈希，并限制 hash 格式；前端无法从 hash 推算 token。
- RLS 和 Storage policy 每次请求服务端验权，anon key 本身不授予内容读取或写入能力。
- 90 天空闲期限、365 天绝对期限和单个/全部撤销共同限制泄露窗口。
- 记录 `created_at`、`last_seen_at`（管理员视图中显示为 `last_used_at`）、`expires_at`、`revoked_at`。
- 十分钟超过 60 次刷新会标记 `high_refresh_rate`；五分钟内来源哈希变化会标记 `rapid_origin_change`。标记仅供检查，不自动封禁移动网络用户。
- signed URL 只在页面内存中短暂缓存，不写入 `sessionStorage`，页面退出时清理。
- 生产 CSP 只允许本站脚本和指定 Supabase 项目连接；Supabase SDK 2.45.0 已固定版本、自托管并校验 SHA-384，不加载统计或第三方运行时代码。
- token 不进入 URL、DOM、控制台输出或用户错误提示。

## 5. 管理员如何检查和撤销

以下函数只授权 `service_role`，应在 Supabase SQL Editor 或受保护的后台环境执行。返回结果不包含原始 token、token hash 或来源 hash。

```sql
select public.get_invite_access_session_overview();
select * from public.list_invite_access_sessions();

-- 撤销单个 session（使用上一个查询返回的 id）
select public.revoke_invite_access_session('session-uuid-here');

-- 紧急撤销全部 session；所有同学之后都需要新邀请码
select public.revoke_all_invite_access_sessions();
```

风险标记不是入侵结论。管理员应结合最近使用时间、权限等级和实际情况判断；确认泄露时撤销对应 session，无法定位时再执行全部撤销。

## 6. 用户需要注意什么

- 不要复制、截图或发送浏览器存储中的访问 token。
- 不要在公共电脑上长期保留访问状态；使用后主动清除本站数据。
- 不要在本站页面运行来源不明的 DevTools 代码、书签脚本或浏览器扩展。
- 发现异常访问或设备丢失时，联系管理员撤销 session。

## 存储方案结论

当前继续使用 `localStorage` 是合适的工程取舍。改用 HttpOnly Cookie 需要新增同源后端代理、Cookie 会话和 CSRF 防护，会实质改变当前纯前端 + Supabase 架构。本站已通过自托管全部运行时脚本、严格 CSP、系统性 HTML 注入防护和服务端最小权限，将 localStorage 的主要风险收敛到“本站发生 XSS 或用户主动运行恶意代码”这一剩余场景。若未来加入可写用户内容、第三方脚本或复杂后台，再重新评估 HttpOnly Cookie 代理。
