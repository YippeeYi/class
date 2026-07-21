-- Class admissions / university map migration.
-- Run after docs/supabase-setup.sql and docs/supabase-final-access-security.sql.
-- This migration intentionally exposes admissions only through the narrowly
-- scoped get_class_admission_map() RPC; there is no anon table SELECT grant.

create table if not exists public.class_universities (
    id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
    name text not null check (length(trim(name)) between 1 and 120),
    short_name text,
    province_code text not null check (province_code ~ '^[0-9]{6}$'),
    province_name text not null check (length(trim(province_name)) between 2 and 20),
    city_name text not null check (length(trim(city_name)) between 2 and 60),
    campus text,
    longitude double precision not null check (longitude between 73 and 136),
    latitude double precision not null check (latitude between 3 and 54),
    logo_path text,
    display_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint class_universities_logo_path_check check (
        logo_path is null or logo_path ~ '^images/admissions/[a-z0-9][a-z0-9/_-]{0,180}\.(png|jpe?g|webp|svg)$'
    )
);

create table if not exists public.class_admissions (
    id uuid primary key default extensions.gen_random_uuid(),
    person_id text not null references public.class_people(id) on update cascade on delete restrict,
    university_id text not null references public.class_universities(id) on update cascade on delete restrict,
    display_name_override text,
    major text,
    display_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint class_admissions_one_final_destination unique (person_id),
    constraint class_admissions_display_name_check check (display_name_override is null or length(trim(display_name_override)) between 1 and 60),
    constraint class_admissions_major_check check (major is null or length(trim(major)) between 1 and 120)
);

create index if not exists class_universities_province_city_order_idx
on public.class_universities (province_code, city_name, display_order, name);
create index if not exists class_admissions_university_order_idx
on public.class_admissions (university_id, display_order, person_id);

create or replace function public.class_admissions_set_updated_at()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists class_universities_set_updated_at on public.class_universities;
create trigger class_universities_set_updated_at before update on public.class_universities
for each row execute function public.class_admissions_set_updated_at();
drop trigger if exists class_admissions_set_updated_at on public.class_admissions;
create trigger class_admissions_set_updated_at before update on public.class_admissions
for each row execute function public.class_admissions_set_updated_at();

alter table public.class_universities enable row level security;
alter table public.class_admissions enable row level security;
revoke all on public.class_universities from public, anon, authenticated;
revoke all on public.class_admissions from public, anon, authenticated;

-- Remove historical policies: an old permissive policy must never revive if a
-- future grant is added by mistake.
do $$
declare item record;
begin
  for item in select p.polname, c.relname
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in ('class_universities','class_admissions')
  loop execute format('drop policy if exists %I on public.%I', item.polname, item.relname); end loop;
end;
$$;

create or replace function public.get_class_admission_map()
returns table (
  university_id text, university_name text, short_name text, province_code text,
  province_name text, city_name text, campus text, longitude double precision,
  latitude double precision, logo_path text, university_order integer,
  display_name text, major text, admission_order integer
)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.has_class_record_access() then
    return;
  end if;
  return query
    select u.id, u.name, u.short_name, u.province_code, u.province_name,
           u.city_name, u.campus, u.longitude, u.latitude, u.logo_path,
           u.display_order,
           coalesce(nullif(trim(a.display_name_override), ''), nullif(trim(p.alias), ''), nullif(trim(p.name), ''), '同学'),
           a.major, a.display_order
      from public.class_admissions a
      join public.class_universities u on u.id = a.university_id
      join public.class_people p on p.id = a.person_id
     order by u.province_code, u.city_name, u.display_order, u.name, a.display_order, a.person_id;
end;
$$;

revoke all on function public.get_class_admission_map() from public, anon, authenticated;
grant execute on function public.get_class_admission_map() to anon, authenticated;
revoke all on function public.class_admissions_set_updated_at() from public, anon, authenticated;

-- Extend the existing single private-bucket read policy without creating a
-- second permissive policy. Logos remain private and are accessed by short
-- lived signed URLs after the invite token is verified.
drop policy if exists "classrecord_private_read" on storage.objects;
create policy "classrecord_private_read"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'classrecord-private' and public.has_class_record_access() and (
    (name !~ '^hidden/' and name ~ '^(data/attachments/|images/record-pages/).+\.(png|jpe?g|webp|gif|svg|pdf|txt|zip|mp3|wav|ogg|mp4|webm)$')
    or (name ~ '^images/admissions/.+\.(png|jpe?g|webp|svg)$')
    or (name ~ '^images/quiz/.+\.(png|jpe?g|webp|gif|svg)$' and public.has_class_record_admin_access())
    or (name ~ '^hidden/(data/attachments/|images/record-pages/).+\.(png|jpe?g|webp|gif|svg|pdf|txt|zip|mp3|wav|ogg|mp4|webm)$' and public.has_class_record_admin_access())
  )
);

notify pgrst, 'reload schema';
