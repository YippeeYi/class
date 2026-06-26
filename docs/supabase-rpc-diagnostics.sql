-- Diagnostics for /rest/v1/rpc/verify_site_key 404 and digest() errors.
-- Run this in Supabase SQL Editor if the browser still reports:
-- POST /rest/v1/rpc/verify_site_key 404 (Not Found)

-- 1. Check whether the RPC exists in the public schema with the expected name.
select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as returns,
    p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'verify_site_key';

-- Expected row:
-- schema_name      public
-- function_name    verify_site_key
-- arguments        input_key text
-- returns          boolean
-- security_definer true

-- 2. Check execute privileges.
select
    has_function_privilege('anon', 'public.verify_site_key(text)', 'execute') as anon_can_execute,
    has_function_privilege('authenticated', 'public.verify_site_key(text)', 'execute') as authenticated_can_execute;

-- Expected:
-- anon_can_execute            true
-- authenticated_can_execute   true

-- 3. Check the key table exists and has active keys.
select
    count(*) filter (where active = true) as active_key_count,
    count(*) as total_key_count
from public.site_access_keys;

-- 4. Test the function directly. Replace the placeholder with your real key.
select public.verify_site_key('REPLACE_WITH_YOUR_SITE_KEY') as key_is_valid;

-- Expected for the correct key:
-- key_is_valid true

-- 5. Force PostgREST to reload its schema cache.
notify pgrst, 'reload schema';

-- If step 4 fails with:
-- ERROR: function digest(text, unknown) does not exist
-- run docs/supabase-fix-verify-site-key.sql.
