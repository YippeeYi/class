-- Class archive Supabase security check.
-- Read-only audit. Run in Supabase SQL Editor after docs/supabase-setup.sql.

with
content_tables(table_schema, table_name, has_hidden_column) as (
    values
        ('public', 'class_records', true),
        ('public', 'class_people', false),
        ('public', 'class_record_pages', true),
        ('public', 'class_page_messages', false),
        ('public', 'class_page_supplements', true),
        ('public', 'class_materials', false),
        ('public', 'class_quiz_questions', false),
        ('public', 'class_credits_page', false)
),
private_tables(table_schema, table_name) as (
    values
        ('public', 'invite_codes'),
        ('public', 'invite_access_sessions'),
        ('public', 'invite_code_settings'),
        ('public', 'invite_code_attempts')
),
required_functions(function_name, arg_types, should_be_public_executable) as (
    values
        ('hash_invite_secret', 'text', false),
        ('invite_request_fingerprint', '', false),
        ('verify_invite_code', 'text', true),
        ('refresh_invite_access', 'text', true),
        ('has_class_record_access', '', true),
        ('has_class_record_admin_access', '', true)
),
table_state as (
    select
        ct.table_schema,
        ct.table_name,
        ct.has_hidden_column,
        c.oid as table_oid,
        coalesce(c.relrowsecurity, false) as rls_enabled
    from content_tables ct
    left join pg_namespace n on n.nspname = ct.table_schema
    left join pg_class c on c.relnamespace = n.oid and c.relname = ct.table_name
),
policy_state as (
    select
        ts.table_schema,
        ts.table_name,
        ts.has_hidden_column,
        ts.rls_enabled,
        exists (
            select 1
            from pg_policy p
            where p.polrelid = ts.table_oid
              and p.polcmd = 'r'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%has_class_record_access%'
        ) as has_access_policy,
        exists (
            select 1
            from pg_policy p
            where p.polrelid = ts.table_oid
              and p.polcmd = 'r'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%hidden%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%has_class_record_admin_access%'
        ) as hidden_admin_policy,
        exists (
            select 1
            from pg_policy p
            where p.polrelid = ts.table_oid
              and p.polcmd = 'r'
              and regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', '', 'g') in ('true', '(true)')
        ) as has_using_true_policy
    from table_state ts
),
private_grants as (
    select
        pt.table_schema,
        pt.table_name,
        has_table_privilege('anon', format('%I.%I', pt.table_schema, pt.table_name), 'select') as anon_can_select,
        has_table_privilege('authenticated', format('%I.%I', pt.table_schema, pt.table_name), 'select') as authenticated_can_select
    from private_tables pt
),
function_state as (
    select
        rf.function_name,
        rf.arg_types,
        rf.should_be_public_executable,
        p.oid as function_oid,
        coalesce(p.prosecdef, false) as security_definer,
        coalesce(array_to_string(p.proconfig, ','), '') as proconfig,
        coalesce(has_function_privilege('anon', p.oid, 'execute'), false) as anon_can_execute,
        coalesce(has_function_privilege('authenticated', p.oid, 'execute'), false) as authenticated_can_execute,
        coalesce(has_function_privilege('public', p.oid, 'execute'), false) as public_can_execute
    from required_functions rf
    left join pg_proc p on p.oid = to_regprocedure(format('public.%I(%s)', rf.function_name, rf.arg_types))
),
storage_policy as (
    select
        exists (
            select 1
            from storage.buckets
            where id = 'classrecord-private'
              and public = false
        ) as private_bucket_ok,
        exists (
            select 1
            from pg_policy p
            join pg_class c on c.oid = p.polrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'storage'
              and c.relname = 'objects'
              and p.polcmd = 'r'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%classrecord-private%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%has_class_record_access%'
        ) as storage_access_policy_ok,
        exists (
            select 1
            from pg_policy p
            join pg_class c on c.oid = p.polrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'storage'
              and c.relname = 'objects'
              and p.polcmd = 'r'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%has_class_record_admin_access%'
              and (
                  pg_get_expr(p.polqual, p.polrelid) ilike '%H[0-9]%'
                  or pg_get_expr(p.polqual, p.polrelid) ilike '%hidden%'
              )
        ) as storage_hidden_admin_policy_ok,
        exists (
            select 1
            from pg_policy p
            join pg_class c on c.oid = p.polrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'storage'
              and c.relname = 'objects'
              and p.polcmd = 'r'
              and regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', '', 'g') in ('true', '(true)')
        ) as storage_has_using_true
),
invite_schema as (
    select
        exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'invite_codes'
              and column_name = 'access_level'
        ) as invite_codes_has_access_level,
        exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'invite_access_sessions'
              and column_name = 'access_level'
        ) as sessions_has_access_level,
        exists (
            select 1
            from pg_constraint
            where conrelid = to_regclass('public.invite_codes')
              and conname = 'invite_codes_access_level_check'
        ) as invite_codes_has_access_level_check,
        exists (
            select 1
            from pg_constraint
            where conrelid = to_regclass('public.invite_access_sessions')
              and conname = 'invite_access_sessions_access_level_check'
        ) as sessions_has_access_level_check,
        exists (
            select 1 from information_schema.tables
            where table_schema = 'public'
              and table_name = 'invite_code_attempts'
        ) as attempts_table_exists,
        exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'invite_code_attempts'
              and indexname = 'invite_code_attempts_recent_idx'
        ) as attempts_recent_index_exists
)

select
    'storage.bucket_private' as check_item,
    case when private_bucket_ok then 'PASS' else 'FAIL' end as result,
    'classrecord-private bucket must be public=false' as detail
from storage_policy

union all
select
    'storage.select_policy_access_check',
    case when storage_access_policy_ok then 'PASS' else 'FAIL' end,
    'storage.objects select policy must require classrecord-private and has_class_record_access()'
from storage_policy

union all
select
    'storage.hidden_admin_policy',
    case when storage_hidden_admin_policy_ok then 'PASS' else 'FAIL' end,
    'hidden/Hxx Storage objects should require has_class_record_admin_access()'
from storage_policy

union all
select
    'storage.no_using_true_policy',
    case when not storage_has_using_true then 'PASS' else 'FAIL' end,
    'storage.objects must not have USING (true) select policy'
from storage_policy

union all
select
    'content.rls_enabled.' || table_name,
    case when rls_enabled then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' must enable RLS'
from policy_state

union all
select
    'content.select_policy_access_check.' || table_name,
    case when has_access_policy then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' select policy must use has_class_record_access()'
from policy_state

union all
select
    'content.hidden_admin_policy.' || table_name,
    case
        when not has_hidden_column then 'PASS'
        when hidden_admin_policy then 'PASS'
        else 'FAIL'
    end,
    table_schema || '.' || table_name || ' hidden rows must require has_class_record_admin_access() when hidden column exists'
from policy_state

union all
select
    'content.no_using_true_policy.' || table_name,
    case when not has_using_true_policy then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' must not have USING (true) select policy'
from policy_state

union all
select
    'private.no_anon_select.' || table_name,
    case when not anon_can_select then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' anon must not directly select'
from private_grants

union all
select
    'private.no_authenticated_select.' || table_name,
    case when not authenticated_can_select then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' authenticated must not directly select'
from private_grants

union all
select
    'function.exists.' || function_name,
    case when function_oid is not null then 'PASS' else 'FAIL' end,
    'required function public.' || function_name || '(' || arg_types || ') must exist'
from function_state

union all
select
    'function.security_definer.' || function_name,
    case when security_definer then 'PASS' else 'FAIL' end,
    'public.' || function_name || ' must be SECURITY DEFINER'
from function_state

union all
select
    'function.search_path.' || function_name,
    case when proconfig ilike '%search_path=public, extensions%' then 'PASS' else 'FAIL' end,
    'public.' || function_name || ' must set search_path = public, extensions'
from function_state

union all
select
    'function.execute_grant.' || function_name,
    case
        when should_be_public_executable and anon_can_execute and authenticated_can_execute then 'PASS'
        when not should_be_public_executable and not anon_can_execute and not authenticated_can_execute and not public_can_execute then 'PASS'
        else 'FAIL'
    end,
    case
        when should_be_public_executable then 'anon/authenticated should execute only this public RPC/helper'
        else 'anon/authenticated/public should not execute this internal helper directly'
    end
from function_state

union all
select
    'invite_schema.invite_codes_access_level',
    case when invite_codes_has_access_level then 'PASS' else 'FAIL' end,
    'invite_codes must include access_level'
from invite_schema

union all
select
    'invite_schema.sessions_access_level',
    case when sessions_has_access_level then 'PASS' else 'FAIL' end,
    'invite_access_sessions must include access_level'
from invite_schema

union all
select
    'invite_schema.invite_codes_access_level_check',
    case when invite_codes_has_access_level_check then 'PASS' else 'FAIL' end,
    'invite_codes access_level must be constrained to normal/admin'
from invite_schema

union all
select
    'invite_schema.sessions_access_level_check',
    case when sessions_has_access_level_check then 'PASS' else 'FAIL' end,
    'invite_access_sessions access_level must be constrained to normal/admin'
from invite_schema

union all
select
    'invite_schema.attempts_table',
    case when attempts_table_exists then 'PASS' else 'FAIL' end,
    'invite_code_attempts must exist for rate limiting'
from invite_schema

union all
select
    'invite_schema.attempts_recent_index',
    case when attempts_recent_index_exists then 'PASS' else 'FAIL' end,
    'invite_code_attempts_recent_idx must exist'
from invite_schema

order by check_item;
