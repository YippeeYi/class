-- Site key operations.
-- Run only the block you need in Supabase SQL Editor.
--
-- Important:
-- - Replace REPLACE_WITH_YOUR_SITE_KEY with the real shared key before running.
-- - The database stores only SHA-256 hashes.
-- - The frontend never reads this table and never stores the raw key.

-- ---------------------------------------------------------------------------
-- 1. Add the first key
-- ---------------------------------------------------------------------------

insert into public.site_access_keys (key_hash, label)
values (
    encode(extensions.digest(convert_to('REPLACE_WITH_YOUR_SITE_KEY', 'UTF8'), 'sha256'), 'hex'),
    'main key'
)
on conflict (key_hash) do update
set active = true,
    disabled_at = null;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 2. Add a new key before switching users to it
-- ---------------------------------------------------------------------------

-- insert into public.site_access_keys (key_hash, label)
-- values (
--     encode(extensions.digest(convert_to('REPLACE_WITH_NEW_SITE_KEY', 'UTF8'), 'sha256'), 'hex'),
--     'new key'
-- )
-- on conflict (key_hash) do update
-- set active = true,
--     disabled_at = null;
--
-- notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 3. Disable an old key
-- ---------------------------------------------------------------------------

-- update public.site_access_keys
-- set active = false,
--     disabled_at = now()
-- where label = 'main key';
--
-- notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 4. Reset when the key is forgotten
-- ---------------------------------------------------------------------------

-- update public.site_access_keys
-- set active = false,
--     disabled_at = now()
-- where active = true;
--
-- insert into public.site_access_keys (key_hash, label)
-- values (
--     encode(extensions.digest(convert_to('REPLACE_WITH_RESET_SITE_KEY', 'UTF8'), 'sha256'), 'hex'),
--     'reset key'
-- )
-- on conflict (key_hash) do update
-- set active = true,
--     disabled_at = null;
--
-- notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 5. Check active keys without revealing raw keys
-- ---------------------------------------------------------------------------

-- select id, label, active, created_at, disabled_at
-- from public.site_access_keys
-- order by created_at desc;
