-- Class archive Supabase security check.
-- Read-only audit. Run in Supabase SQL Editor after docs/supabase-setup.sql.

with
content_tables(table_schema, table_name, has_hidden_column, admin_only) as (
    values
        ('public', 'class_records', true, false),
        ('public', 'class_people', false, false),
        ('public', 'class_record_pages', true, false),
        ('public', 'class_page_messages', false, false),
        ('public', 'class_page_supplements', true, false),
        ('public', 'class_materials', false, false),
        ('public', 'class_quiz_questions', false, true),
        ('public', 'class_credits_page', false, false)
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
        ('has_class_record_admin_access', '', true),
        ('revoke_invite_access_session', 'uuid', false),
        ('revoke_all_invite_access_sessions', '', false),
        ('get_invite_access_session_overview', '', false),
        ('list_invite_access_sessions', '', false),
        ('cleanup_invite_code_attempts', '', false)
),
table_state as (
    select
        ct.table_schema,
        ct.table_name,
        ct.has_hidden_column,
        ct.admin_only,
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
        ts.admin_only,
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
              and pg_get_expr(p.polqual, p.polrelid) ilike '%has_class_record_admin_access%'
        ) as has_admin_policy,
        exists (
            select 1
            from pg_policy p
            where p.polrelid = ts.table_oid
              and p.polcmd = 'r'
              and regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', '', 'g') in ('true', '(true)')
        ) as has_using_true_policy
        ,(
            select count(*)
            from pg_policy p
            where p.polrelid = ts.table_oid
              and p.polcmd = 'r'
        ) as select_policy_count
        ,(
            select count(*)
            from pg_policy p
            where p.polrelid = ts.table_oid
              and p.polcmd in ('a', 'w', 'd', '*')
        ) as write_policy_count
        ,has_table_privilege('anon', format('%I.%I', ts.table_schema, ts.table_name), 'insert,update,delete,truncate,references,trigger') as anon_can_write
        ,has_table_privilege('authenticated', format('%I.%I', ts.table_schema, ts.table_name), 'insert,update,delete,truncate,references,trigger') as authenticated_can_write
    from table_state ts
),
private_grants as (
    select
        pt.table_schema,
        pt.table_name,
        has_table_privilege('anon', format('%I.%I', pt.table_schema, pt.table_name), 'select') as anon_can_select,
        has_table_privilege('authenticated', format('%I.%I', pt.table_schema, pt.table_name), 'select') as authenticated_can_select,
        has_table_privilege('anon', format('%I.%I', pt.table_schema, pt.table_name), 'insert,update,delete,truncate,references,trigger') as anon_can_write,
        has_table_privilege('authenticated', format('%I.%I', pt.table_schema, pt.table_name), 'insert,update,delete,truncate,references,trigger') as authenticated_can_write,
        (
            select count(*)
            from pg_policy p
            where p.polrelid = to_regclass(format('%I.%I', pt.table_schema, pt.table_name))
        ) as policy_count
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
        (
            select count(*)
            from pg_policy p
            join pg_class c on c.oid = p.polrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'storage'
              and c.relname = 'objects'
              and p.polcmd = 'r'
        ) as storage_select_policy_count,
        exists (
            select 1
            from pg_policy p
            join pg_class c on c.oid = p.polrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'storage'
              and c.relname = 'objects'
              and p.polcmd = 'r'
              and p.polname = 'classrecord_private_read'
              and p.polpermissive = true
              and cardinality(p.polroles) = 2
              and p.polroles @> array[
                  (select oid from pg_roles where rolname = 'anon'),
                  (select oid from pg_roles where rolname = 'authenticated')
              ]::oid[]
              and pg_get_expr(p.polqual, p.polrelid) ilike '%classrecord-private%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%has_class_record_access%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%has_class_record_admin_access%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%hidden/%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%data/attachments/%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%images/record-pages/%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%images/quiz/%'
              and pg_get_expr(p.polqual, p.polrelid) not ilike '%H[0-9]%'
        ) as storage_only_allowed_policy_ok,
        exists (
            select 1
            from pg_policy p
            join pg_class c on c.oid = p.polrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'storage'
              and c.relname = 'objects'
              and p.polcmd = 'r'
              and regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', '', 'g') in ('true', '(true)')
        ) as storage_has_using_true,
        exists (
            select 1
            from pg_policy p
            join pg_class c on c.oid = p.polrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'storage'
              and c.relname = 'objects'
              and p.polcmd in ('a', 'w', 'd', '*')
        ) as storage_has_write_policy
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
        not exists (
            select required.column_name
            from (values
                ('created_at'), ('last_seen_at'), ('expires_at'), ('revoked_at'),
                ('last_origin_hash'), ('refresh_window_started_at'), ('refresh_count'),
                ('risk_flags'), ('risk_flagged_at')
            ) as required(column_name)
            where not exists (
                select 1 from information_schema.columns c
                where c.table_schema = 'public'
                  and c.table_name = 'invite_access_sessions'
                  and c.column_name = required.column_name
            )
        ) as sessions_has_lifecycle_metadata,
        exists (
            select 1
            from pg_constraint
            where conrelid = to_regclass('public.invite_codes')
              and conname = 'invite_codes_access_level_check'
              and pg_get_constraintdef(oid) ilike '%normal%'
              and pg_get_constraintdef(oid) ilike '%admin%'
        ) as invite_codes_has_access_level_check,
        exists (
            select 1
            from pg_constraint
            where conrelid = to_regclass('public.invite_access_sessions')
              and conname = 'invite_access_sessions_access_level_check'
              and pg_get_constraintdef(oid) ilike '%normal%'
              and pg_get_constraintdef(oid) ilike '%admin%'
        ) as sessions_has_access_level_check,
        exists (
            select 1
            from pg_constraint
            where conrelid = to_regclass('public.invite_access_sessions')
              and conname = 'invite_access_sessions_token_hash_format_check'
              and pg_get_constraintdef(oid) ilike '%64%'
        ) as sessions_has_token_hash_check,
        not exists (
            select 1 from public.invite_codes
            where access_level is null
               or access_level not in ('normal', 'admin')
        ) as invite_codes_access_levels_valid,
        not exists (
            select 1 from public.invite_access_sessions
            where access_level is null
               or access_level not in ('normal', 'admin')
        ) as sessions_access_levels_valid,
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
        ) as attempts_recent_index_exists,
        exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'invite_code_attempts'
              and indexname = 'invite_code_attempts_cleanup_idx'
        ) as attempts_cleanup_index_exists
),
invite_hardening as (
    select
        pg_get_functiondef(to_regprocedure('public.invite_request_fingerprint()')) as fingerprint_definition,
        pg_get_functiondef(to_regprocedure('public.verify_invite_code(text)')) as verify_definition,
        pg_get_functiondef(to_regprocedure('public.refresh_invite_access(text)')) as refresh_definition,
        pg_get_functiondef(to_regprocedure('public.has_class_record_access()')) as access_definition,
        pg_get_functiondef(to_regprocedure('public.has_class_record_admin_access()')) as admin_definition,
        coalesce(has_function_privilege('service_role', to_regprocedure('public.revoke_invite_access_session(uuid)'), 'execute'), false) as service_can_revoke_one,
        coalesce(has_function_privilege('service_role', to_regprocedure('public.revoke_all_invite_access_sessions()'), 'execute'), false) as service_can_revoke_all,
        coalesce(has_function_privilege('service_role', to_regprocedure('public.get_invite_access_session_overview()'), 'execute'), false) as service_can_view_overview,
        coalesce(has_function_privilege('service_role', to_regprocedure('public.list_invite_access_sessions()'), 'execute'), false) as service_can_list_sessions,
        coalesce(has_function_privilege('anon', to_regprocedure('public.get_invite_access_session_overview()'), 'execute'), true) as anon_can_view_overview,
        coalesce(has_function_privilege('anon', to_regprocedure('public.list_invite_access_sessions()'), 'execute'), true) as anon_can_list_sessions,
        coalesce(has_function_privilege('service_role', to_regprocedure('public.cleanup_invite_code_attempts()'), 'execute'), false) as service_can_cleanup
)

select
    'storage.bucket_private' as check_item,
    case when private_bucket_ok then 'PASS' else 'FAIL' end as result,
    'classrecord-private bucket must be public=false' as detail
from storage_policy

union all
select
    'storage.select_policy_access_check',
    case when storage_select_policy_count = 1 and storage_only_allowed_policy_ok then 'PASS' else 'FAIL' end,
    'storage.objects must have exactly one SELECT policy: classrecord_private_read with invite and hidden-prefix admin checks'
from storage_policy

union all
select
    'storage.no_extra_select_policy',
    case when storage_select_policy_count = 1 and storage_only_allowed_policy_ok then 'PASS' else 'FAIL' end,
    'any additional storage.objects SELECT policy is unauthorized and must fail this audit'
from storage_policy

union all
select
    'storage.no_using_true_policy',
    case when not storage_has_using_true then 'PASS' else 'FAIL' end,
    'storage.objects must not have USING (true) select policy'
from storage_policy

union all
select
    'storage.no_write_policy',
    case when not storage_has_write_policy then 'PASS' else 'FAIL' end,
    'frontend roles must not receive Storage INSERT/UPDATE/DELETE policies'
from storage_policy

union all
select
    'schema.quiz_required_columns',
    case when not exists (
        select required.column_name
        from (values
            ('id'), ('content_key'), ('question_group'), ('question_type'),
            ('prompt'), ('choices'), ('answer'), ('explanation'),
            ('image_path'), ('sort_order'), ('raw')
        ) as required(column_name)
        except
        select columns.column_name
        from information_schema.columns
        where columns.table_schema = 'public'
          and columns.table_name = 'class_quiz_questions'
    ) then 'PASS' else 'FAIL' end,
    'public.class_quiz_questions must contain every column used by the migration script'

union all
select
    'content.rls_enabled.' || table_name,
    case when rls_enabled then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' must enable RLS'
from policy_state

union all
select
    'content.single_select_policy.' || table_name,
    case when select_policy_count = 1 then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' must have exactly one SELECT policy'
from policy_state

union all
select
    'content.no_write_policy.' || table_name,
    case when write_policy_count = 0 then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' must not have INSERT/UPDATE/DELETE policies'
from policy_state

union all
select
    'content.no_anon_write_grant.' || table_name,
    case when not anon_can_write then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' anon must not have write grants'
from policy_state

union all
select
    'content.no_authenticated_write_grant.' || table_name,
    case when not authenticated_can_write then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' authenticated must not have write grants'
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
    'content.admin_only_policy.' || table_name,
    case
        when not admin_only then 'PASS'
        when has_admin_policy then 'PASS'
        else 'FAIL'
    end,
    table_schema || '.' || table_name || ' admin-only content must require has_class_record_admin_access()'
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
    'private.no_policy.' || table_name,
    case when policy_count = 0 then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' must have no direct-access RLS policies'
from private_grants

union all
select
    'private.no_anon_write.' || table_name,
    case when not anon_can_write then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' anon must not write'
from private_grants

union all
select
    'private.no_authenticated_write.' || table_name,
    case when not authenticated_can_write then 'PASS' else 'FAIL' end,
    table_schema || '.' || table_name || ' authenticated must not write'
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
    'invite_schema.session_lifecycle_metadata',
    case when sessions_has_lifecycle_metadata then 'PASS' else 'FAIL' end,
    'sessions must record created/last-used/absolute-expiry/revocation and non-blocking anomaly metadata'
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
    'invite_schema.session_token_hash_format',
    case when sessions_has_token_hash_check then 'PASS' else 'FAIL' end,
    'session table must store a 64-character SHA-256 hex hash, never the bearer token'
from invite_schema

union all
select
    'invite_schema.invite_codes_access_levels_valid',
    case when invite_codes_access_levels_valid then 'PASS' else 'FAIL' end,
    'invite_codes must contain only normal/admin access_level values'
from invite_schema

union all
select
    'invite_schema.sessions_access_levels_valid',
    case when sessions_access_levels_valid then 'PASS' else 'FAIL' end,
    'invite_access_sessions must contain only normal/admin access_level values'
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

union all
select
    'invite_schema.attempts_cleanup_index',
    case when attempts_cleanup_index_exists then 'PASS' else 'FAIL' end,
    'invite_code_attempts_cleanup_idx must support scheduled cleanup'
from invite_schema

union all
select
    'invite.absolute_session_lifetime',
    case when refresh_definition ilike '%expires_at > now()%'
           and refresh_definition ilike '%created_at%365 days%'
           and access_definition ilike '%expires_at > now()%'
           and admin_definition ilike '%expires_at > now()%'
         then 'PASS' else 'FAIL' end,
    'refresh and access helpers must enforce explicit expiry plus the 365-day defensive bound'
from invite_hardening

union all
select
    'invite.token_generation_and_hashing',
    case when verify_definition ilike '%gen_random_bytes(32)%'
           and verify_definition ilike '%hash_invite_secret(access_token)%'
           and verify_definition ilike '%accessToken%access_token%'
         then 'PASS' else 'FAIL' end,
    'invite exchange must return a 256-bit random token while persisting only its peppered hash'
from invite_hardening

union all
select
    'invite.non_blocking_anomaly_detection',
    case when refresh_definition ilike '%high_refresh_rate%'
           and refresh_definition ilike '%rapid_origin_change%'
           and refresh_definition ilike '%last_origin_hash%'
         then 'PASS' else 'FAIL' end,
    'refresh must record pseudonymous anomaly flags without IP/device binding'
from invite_hardening

union all
select
    'invite.admin_session_visibility',
    case when service_can_view_overview and service_can_list_sessions
           and not anon_can_view_overview and not anon_can_list_sessions
         then 'PASS' else 'FAIL' end,
    'service_role may inspect session metadata, while anon cannot access it'
from invite_hardening

union all
select
    'invite.multi_axis_rate_limit',
    case when fingerprint_definition ilike '%rate:ip:%'
           and fingerprint_definition not ilike '%user-agent%'
           and verify_definition ilike '%rate:code:%'
           and verify_definition ilike '%rate:global%'
         then 'PASS' else 'FAIL' end,
    'verification must rate-limit by trusted proxy IP, attempted code, and global volume without User-Agent dependence'
from invite_hardening

union all
select
    'invite.no_inline_history_cleanup',
    case when verify_definition not ilike '%delete from public.invite_code_attempts%' then 'PASS' else 'FAIL' end,
    'verify_invite_code must not delete historical attempts on every request'
from invite_hardening

union all
select
    'invite.service_revocation_and_cleanup',
    case when service_can_revoke_one and service_can_revoke_all and service_can_cleanup then 'PASS' else 'FAIL' end,
    'service_role must be able to revoke one/all sessions and run scheduled attempt cleanup'
from invite_hardening

order by check_item;
