-- Read-only diagnosis for Storage anonymous object downloads.
-- Run in Supabase SQL Editor after a live test reports:
-- "unauthenticated anon can download a confirmed existing ordinary asset".
-- Do not paste bearer tokens into this script.
--
-- This file intentionally returns one result set so Supabase SQL Editor does
-- not hide earlier SELECT outputs.

with
bucket_state as (
    select
        coalesce(bool_or(public = false), false) as private_bucket_ok,
        coalesce(jsonb_agg(jsonb_build_object(
            'id', id,
            'name', name,
            'public', public
        )), '[]'::jsonb) as detail
    from storage.buckets
    where id = 'classrecord-private'
),
rls_state as (
    select
        coalesce(bool_or(c.relrowsecurity), false) as rls_enabled,
        coalesce(jsonb_agg(jsonb_build_object(
            'schema', n.nspname,
            'table', c.relname,
            'rls_enabled', c.relrowsecurity,
            'rls_forced', c.relforcerowsecurity
        )), '[]'::jsonb) as detail
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
),
policy_detail as (
    select
        p.polname as policy_name,
        case p.polcmd
            when 'r' then 'SELECT'
            when 'a' then 'INSERT'
            when 'w' then 'UPDATE'
            when 'd' then 'DELETE'
            else 'ALL'
        end as command,
        p.polpermissive as permissive,
        array(
            select r.rolname
            from pg_roles r
            where r.oid = any(p.polroles)
            order by r.rolname
        ) as roles,
        pg_get_expr(p.polqual, p.polrelid) as using_expression,
        pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expression
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
),
policy_summary as (
    select
        count(*) filter (where command = 'SELECT') as select_policy_count,
        count(*) filter (
            where command = 'SELECT'
              and policy_name = 'classrecord_private_read'
              and using_expression ilike '%has_class_record_access%'
              and using_expression ilike '%has_class_record_admin_access%'
        ) as allowed_select_policy_count,
        count(*) filter (
            where command = 'SELECT'
              and regexp_replace(using_expression, '\s+', '', 'g') in ('true', '(true)')
        ) as using_true_select_policy_count,
        coalesce(jsonb_agg(jsonb_build_object(
            'policy_name', policy_name,
            'command', command,
            'permissive', permissive,
            'roles', roles,
            'using_expression', using_expression,
            'with_check_expression', with_check_expression
        ) order by policy_name), '[]'::jsonb) as detail
    from policy_detail
),
access_state as (
    select
        public.has_class_record_access() as no_header_access,
        public.has_class_record_admin_access() as no_header_admin_access
)
select
    'storage.bucket_private' as check_item,
    case when private_bucket_ok then 'PASS' else 'FAIL' end as result,
    detail::text as detail
from bucket_state

union all
select
    'storage.objects_rls_enabled',
    case when rls_enabled then 'PASS' else 'FAIL' end,
    detail::text
from rls_state

union all
select
    'storage.exactly_one_guarded_select_policy',
    case
        when select_policy_count = 1
         and allowed_select_policy_count = 1
         and using_true_select_policy_count = 0
        then 'PASS'
        else 'FAIL'
    end,
    jsonb_build_object(
        'select_policy_count', select_policy_count,
        'allowed_select_policy_count', allowed_select_policy_count,
        'using_true_select_policy_count', using_true_select_policy_count
    )::text
from policy_summary

union all
select
    'storage.policy_details',
    case
        when select_policy_count = 1
         and allowed_select_policy_count = 1
         and using_true_select_policy_count = 0
        then 'PASS'
        else 'FAIL'
    end,
    detail::text
from policy_summary

union all
select
    'access.no_header_has_access',
    case when no_header_access = false then 'PASS' else 'FAIL' end,
    jsonb_build_object('result_should_be_false', no_header_access)::text
from access_state

union all
select
    'access.no_header_has_admin_access',
    case when no_header_admin_access = false then 'PASS' else 'FAIL' end,
    jsonb_build_object('result_should_be_false', no_header_admin_access)::text
from access_state

order by check_item;
