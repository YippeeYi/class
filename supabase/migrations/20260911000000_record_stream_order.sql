-- Expose only the ordering of records the caller may already read. Scan rows,
-- image paths, hidden record names and range endpoints remain administrator-only.
create or replace function public.get_class_record_order(include_hidden boolean default false)
returns table (file_name text, page text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select r.file_name, p.page
    from public.class_records r
    cross join lateral (
        select scan.page
        from public.class_record_pages scan
        where not scan.hidden
          and r.file_name between least(nullif(scan.start_file, ''), nullif(scan.end_file, ''))
                              and greatest(nullif(scan.start_file, ''), nullif(scan.end_file, ''))
        order by scan.sort_order nulls last, scan.page
        limit 1
    ) p
    where public.has_class_record_access()
      and (not r.hidden or (include_hidden and public.has_class_record_admin_access()))
    order by r.file_name;
$$;

revoke all on function public.get_class_record_order(boolean) from public;
grant execute on function public.get_class_record_order(boolean) to anon, authenticated, service_role;

-- Optional hidden auxiliary records obey the same server boundary as ordinary records.
drop policy if exists "class_page_messages_read" on public.class_page_messages;
create policy "class_page_messages_read" on public.class_page_messages for select
to anon, authenticated
using (public.has_class_record_access() and (not hidden or public.has_class_record_admin_access()));

drop policy if exists "class_page_supplements_read" on public.class_page_supplements;
create policy "class_page_supplements_read" on public.class_page_supplements for select
to anon, authenticated
using (public.has_class_record_access() and (not hidden or public.has_class_record_admin_access()));

notify pgrst, 'reload schema';
