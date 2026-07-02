-- Diagnostics and fixes for:
-- 1. /rest/v1/rpc/verify_site_key 404 and digest() errors.
-- 2. migrate-secure-content.mjs importing people failed because class_people.name column is missing.
--
-- Run this in Supabase SQL Editor if the browser still reports:
-- POST /rest/v1/rpc/verify_site_key 404 (Not Found)
--
-- Or if migration reports:
-- Could not find the 'name' column of 'class_people' in the schema cache


/************************************************************
 * 0. Fix class_people.name column for people JSON "name" field
 ************************************************************/

do $$
begin
    if to_regclass('public.class_people') is null then
        raise notice 'Table public.class_people does not exist. Skip adding name column.';
    else
        execute 'alter table public.class_people add column if not exists name text';

        execute '
            update public.class_people
            set name = coalesce(nullif(name, ''''), nullif(alias, ''''), id)
            where name is null or name = ''''
        ';

        execute '
            comment on column public.class_people.name is
            ''Display name for people. id remains the internal unique identifier.''
        ';

        raise notice 'Checked public.class_people.name column and backfilled empty values.';
    end if;
end $$;

-- Check whether the name column now exists.
select
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'class_people'
  and column_name = 'name';

-- Check several people rows after backfill.
select
    id,
    name,
    alias,
    role
from public.class_people
order by id
limit 20;


/************************************************************
 * 1. Check whether the RPC exists in the public schema
 *    with the expected name.
 ************************************************************/

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


/************************************************************
 * 2. Check execute privileges.
 ************************************************************/

select
    has_function_privilege('anon', 'public.verify_site_key(text)', 'execute') as anon_can_execute,
    has_function_privilege('authenticated', 'public.verify_site_key(text)', 'execute') as authenticated_can_execute;

-- Expected:
-- anon_can_execute            true
-- authenticated_can_execute   true


/************************************************************
 * 3. Check the key table exists and has active keys.
 ************************************************************/

select
    count(*) filter (where active = true) as active_key_count,
    count(*) as total_key_count
from public.site_access_keys;


/************************************************************
 * 4. Test the function directly.
 *    Replace the placeholder with your real site key.
 ************************************************************/

select public.verify_site_key('REPLACE_WITH_YOUR_SITE_KEY') as key_is_valid;

-- Expected for the correct key:
-- key_is_valid true


/************************************************************
 * 5. Force PostgREST to reload its schema cache.
 ************************************************************/

notify pgrst, 'reload schema';


/************************************************************
 * 6. Final verification queries.
 ************************************************************/

-- Verify class_people.name exists and can be read through SQL.
select
    id,
    name,
    alias,
    role
from public.class_people
order by id
limit 20;

-- Verify verify_site_key still exists after schema reload.
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


/************************************************************
 * Notes
 ************************************************************/

-- If step 4 fails with:
-- ERROR: function digest(text, unknown) does not exist
--
-- Then pgcrypto or the verify_site_key function's search_path may still need repair.
-- In that case, run your docs/supabase-fix-verify-site-key.sql file.
--
-- If migrate-secure-content.mjs still reports:
-- Could not find the 'name' column of 'class_people' in the schema cache
--
-- Wait a few seconds, then run only:
-- notify pgrst, 'reload schema';
--
-- After that, rerun:
-- node scripts/migrate-secure-content.mjs