-- One database-owned business revision; invitations and sessions never advance it.
create table public.class_data_version (
    singleton boolean primary key default true check (singleton),
    revision bigint not null default 1
);
insert into public.class_data_version (singleton) values (true);
alter table public.class_data_version enable row level security;
revoke all on public.class_data_version from public, anon, authenticated;
grant select, update on public.class_data_version to service_role;

create function public.bump_class_data_version() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
    update public.class_data_version set revision = revision + 1 where singleton;
    return null;
end;
$$;
revoke all on function public.bump_class_data_version() from public, anon, authenticated;

-- Statement triggers include deletions and truncation, including direct SQL edits.
do $$
declare name text;
begin
    foreach name in array array['class_records', 'class_people', 'class_record_pages',
      'class_page_messages', 'class_page_supplements', 'class_materials',
      'class_quiz_questions', 'class_credits_page', 'class_private_assets']
    loop
        execute format('create trigger business_data_changed after insert or update or delete or truncate on public.%I for each statement execute function public.bump_class_data_version()', name);
    end loop;
end;
$$;

create function public.get_class_data_version() returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
    if public.has_class_record_access() is not true then
        raise insufficient_privilege using message = 'Valid invitation access required';
    end if;
    return (select revision::text from public.class_data_version where singleton);
end;
$$;
revoke all on function public.get_class_data_version() from public;
grant execute on function public.get_class_data_version() to anon, authenticated, service_role;
notify pgrst, 'reload schema';
