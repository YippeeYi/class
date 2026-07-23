-- Emergency repair for confirmed anonymous reads from classrecord-private.
-- Run in Supabase SQL Editor. This project intentionally has one Storage
-- policy only; the script removes every historical storage.objects policy so
-- PostgreSQL permissive-policy OR semantics cannot preserve an old bypass.
-- No bucket objects are changed or deleted.

begin;

insert into storage.buckets (id, name, public)
values ('classrecord-private', 'classrecord-private', false)
on conflict (id) do update
set public = false;

do $$
declare
    item record;
begin
    for item in
        select p.polname as policy_name
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'storage'
          and c.relname = 'objects'
    loop
        execute format('drop policy if exists %I on storage.objects', item.policy_name);
    end loop;
end;
$$;

create policy "classrecord_private_read"
on storage.objects for select
to anon, authenticated
using (
    bucket_id = 'classrecord-private'
    and public.has_class_record_access()
    and (
        (
            name !~ '^hidden/'
            and name ~ '^(data/attachments/|images/record-pages/).+\.(png|jpe?g|webp|gif|svg|pdf|txt|zip|mp3|wav|ogg|mp4|webm)$'
        )
        or (
            name ~ '^images/quiz/.+\.(png|jpe?g|webp|gif|svg)$'
            and public.has_class_record_admin_access()
        )
        or (
            name ~ '^hidden/(data/attachments/|images/record-pages/).+\.(png|jpe?g|webp|gif|svg|pdf|txt|zip|mp3|wav|ogg|mp4|webm)$'
            and public.has_class_record_admin_access()
        )
        or name = 'images/private/meal-map.png'
    )
);

commit;

-- Expected: exactly one row named classrecord_private_read, command SELECT.
select
    p.polname as policy_name,
    case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                  when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end as command,
    pg_get_expr(p.polqual, p.polrelid) as using_expression
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage'
  and c.relname = 'objects'
order by p.polname;

with storage_policy as (
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
              and pg_get_expr(p.polqual, p.polrelid) ilike '%has_class_record_access%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%has_class_record_admin_access%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%images/record-pages/%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%images/quiz/%'
              and pg_get_expr(p.polqual, p.polrelid) ilike '%hidden/%'
        ) as only_allowed_policy_ok
)
select
    'storage.repair_bucket_private' as check_item,
    case when private_bucket_ok then 'PASS' else 'FAIL' end as result,
    'classrecord-private must be public=false' as detail
from storage_policy

union all
select
    'storage.repair_exactly_one_select_policy',
    case when storage_select_policy_count = 1 and only_allowed_policy_ok then 'PASS' else 'FAIL' end,
    'storage.objects must have exactly one guarded SELECT policy after repair'
from storage_policy;
