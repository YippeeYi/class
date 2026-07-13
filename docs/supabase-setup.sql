-- Class archive Supabase setup.
-- Execute this file in Supabase SQL Editor first.
--
-- This script creates:
-- 1. one-time invite code hash table
-- 2. verify_invite_code(input_code text) RPC
-- 3. read-only content tables used by the frontend, including page messages
-- 4. RLS policies for necessary read access
-- 5. Storage signed URL support for the private bucket
--
-- It does not insert real invite codes. After this file succeeds, run
-- scripts/generate-invite-codes.mjs locally to add hashed invite codes.
-- Before using invite codes, set the same pepper used by the local generator:
-- insert into public.invite_code_settings (id, pepper)
-- values (1, 'replace-with-a-long-random-secret')
-- on conflict (id) do update set pepper = excluded.pepper, updated_at = now();

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- One-time invite codes
-- ---------------------------------------------------------------------------

create table if not exists public.invite_code_settings (
    id smallint primary key default 1 check (id = 1),
    pepper text not null check (length(pepper) >= 16),
    updated_at timestamptz not null default now()
);

create table if not exists public.invite_codes (
    id uuid primary key default gen_random_uuid(),
    code_hash text not null unique,
    used boolean not null default false,
    used_at timestamptz,
    created_at timestamptz not null default now(),
    expires_at timestamptz,
    note text,
    access_level text not null default 'normal' check (access_level in ('normal', 'admin'))
);

create table if not exists public.invite_access_sessions (
    id uuid primary key default gen_random_uuid(),
    token_hash text not null unique,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '365 days'),
    revoked_at timestamptz,
    access_level text not null default 'normal' check (access_level in ('normal', 'admin')),
    last_origin_hash text,
    refresh_window_started_at timestamptz,
    refresh_count integer not null default 0,
    risk_flags text[] not null default '{}'::text[],
    risk_flagged_at timestamptz
);

alter table public.invite_codes
add column if not exists access_level text not null default 'normal';

alter table public.invite_access_sessions
add column if not exists access_level text not null default 'normal';

alter table public.invite_access_sessions add column if not exists expires_at timestamptz;
update public.invite_access_sessions set expires_at = created_at + interval '365 days' where expires_at is null;
alter table public.invite_access_sessions alter column expires_at set default (now() + interval '365 days');
alter table public.invite_access_sessions alter column expires_at set not null;
alter table public.invite_access_sessions add column if not exists last_origin_hash text;
alter table public.invite_access_sessions add column if not exists refresh_window_started_at timestamptz;
alter table public.invite_access_sessions add column if not exists refresh_count integer not null default 0;
alter table public.invite_access_sessions add column if not exists risk_flags text[] not null default '{}'::text[];
alter table public.invite_access_sessions add column if not exists risk_flagged_at timestamptz;

alter table public.invite_codes
alter column access_level set default 'normal';

update public.invite_codes
set access_level = 'normal'
where access_level is null
   or access_level not in ('normal', 'admin');

alter table public.invite_codes
alter column access_level set not null;

alter table public.invite_access_sessions
alter column access_level set default 'normal';

update public.invite_access_sessions
set access_level = 'normal'
where access_level is null
   or access_level not in ('normal', 'admin');

alter table public.invite_access_sessions
alter column access_level set not null;

alter table public.invite_codes
drop constraint if exists invite_codes_access_level_check;

alter table public.invite_codes
add constraint invite_codes_access_level_check
check (access_level in ('normal', 'admin'));

alter table public.invite_access_sessions
drop constraint if exists invite_access_sessions_access_level_check;

alter table public.invite_access_sessions
add constraint invite_access_sessions_access_level_check
check (access_level in ('normal', 'admin'));

alter table public.invite_access_sessions
drop constraint if exists invite_access_sessions_token_hash_format_check;

alter table public.invite_access_sessions
add constraint invite_access_sessions_token_hash_format_check
check (token_hash ~ '^[0-9a-f]{64}$');

create index if not exists invite_access_sessions_active_idx
on public.invite_access_sessions (revoked_at, expires_at, last_seen_at);

create table if not exists public.invite_code_attempts (
    id bigint generated by default as identity primary key,
    attempt_hash text not null,
    attempted_at timestamptz not null default now(),
    success boolean not null default false
);

create index if not exists invite_code_attempts_recent_idx
on public.invite_code_attempts (attempt_hash, attempted_at desc);

create index if not exists invite_code_attempts_cleanup_idx
on public.invite_code_attempts (attempted_at);

alter table public.invite_codes enable row level security;
alter table public.invite_access_sessions enable row level security;
alter table public.invite_code_settings enable row level security;
alter table public.invite_code_attempts enable row level security;
revoke all on public.invite_codes from public;
revoke all on public.invite_access_sessions from public;
revoke all on public.invite_code_settings from public;
revoke all on public.invite_code_attempts from public;
revoke all on public.invite_codes from anon, authenticated;
revoke all on public.invite_access_sessions from anon, authenticated;
revoke all on public.invite_code_settings from anon, authenticated;
revoke all on public.invite_code_attempts from anon, authenticated;

-- These tables are reachable only from SECURITY DEFINER functions. Remove
-- every historical policy as well as every frontend grant so an old policy
-- cannot become active again after a future grant change.
do $$
declare
    item record;
begin
    for item in
        select p.polname as policy_name, n.nspname as schema_name, c.relname as table_name
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in (
              'invite_codes',
              'invite_access_sessions',
              'invite_code_settings',
              'invite_code_attempts'
          )
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            item.policy_name,
            item.schema_name,
            item.table_name
        );
    end loop;
end;
$$;

create or replace function public.hash_invite_secret(raw_value text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    pepper_value text;
begin
    select pepper into pepper_value
      from public.invite_code_settings
     where id = 1;
    if pepper_value is null or length(pepper_value) < 16 then
        raise exception 'Invite code pepper is not configured';
    end if;
    return encode(
        extensions.digest(
            convert_to(pepper_value || ':' || coalesce(raw_value, ''), 'UTF8'),
            'sha256'
        ),
        'hex'
    );
end;
$$;

create or replace function public.invite_request_fingerprint()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    headers jsonb;
    ip_value text;
begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
    ip_value := coalesce(
        headers->>'cf-connecting-ip',
        headers->>'x-real-ip',
        split_part(headers->>'x-forwarded-for', ',', 1),
        'unknown'
    );
    return public.hash_invite_secret('rate:ip:' || left(coalesce(ip_value, 'unknown'), 96));
exception when others then
    return public.hash_invite_secret('rate:ip:unknown');
end;
$$;

create or replace function public.verify_invite_code(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    normalized_code text := upper(regexp_replace(trim(coalesce(input_code, '')), '\s+', '', 'g'));
    target_hash text;
    consumed_access_level text;
    access_token text;
    attempt_hash_value text;
    code_attempt_hash_value text;
    global_attempt_hash_value text;
    recent_failures integer;
    recent_code_failures integer;
    recent_global_attempts integer;
begin
    attempt_hash_value := public.invite_request_fingerprint();
    code_attempt_hash_value := public.hash_invite_secret('rate:code:' || normalized_code);
    global_attempt_hash_value := public.hash_invite_secret('rate:global');

    perform pg_advisory_xact_lock(hashtext('classrecord-invite-rate-limit'));

    select count(*)::integer
      into recent_failures
      from public.invite_code_attempts
     where attempt_hash = attempt_hash_value
       and success = false
       and attempted_at > now() - interval '15 minutes';

    select count(*)::integer
      into recent_code_failures
      from public.invite_code_attempts
     where attempt_hash = code_attempt_hash_value
       and success = false
       and attempted_at > now() - interval '30 minutes';

    select count(*)::integer
      into recent_global_attempts
      from public.invite_code_attempts
     where attempt_hash = global_attempt_hash_value
       and attempted_at > now() - interval '5 minutes';

    if recent_failures >= 20
       or recent_code_failures >= 10
       or recent_global_attempts >= 300 then
        insert into public.invite_code_attempts (attempt_hash, success)
        values
            (attempt_hash_value, false),
            (code_attempt_hash_value, false),
            (global_attempt_hash_value, false);
        return jsonb_build_object('ok', false);
    end if;

    if normalized_code = '' or length(normalized_code) > 64 then
        insert into public.invite_code_attempts (attempt_hash, success)
        values
            (attempt_hash_value, false),
            (code_attempt_hash_value, false),
            (global_attempt_hash_value, false);
        return jsonb_build_object('ok', false);
    end if;

    target_hash := public.hash_invite_secret(normalized_code);

    update public.invite_codes
       set used = true,
           used_at = now()
     where code_hash = target_hash
       and used = false
       and (expires_at is null or expires_at > now())
     returning access_level into consumed_access_level;

    if consumed_access_level is not null then
        access_token := encode(extensions.gen_random_bytes(32), 'hex');
        insert into public.invite_access_sessions (token_hash, access_level, last_origin_hash)
        values (public.hash_invite_secret(access_token), consumed_access_level, attempt_hash_value);
        insert into public.invite_code_attempts (attempt_hash, success)
        values
            (attempt_hash_value, true),
            (code_attempt_hash_value, true),
            (global_attempt_hash_value, true);
        return jsonb_build_object('ok', true, 'accessToken', access_token);
    end if;

    insert into public.invite_code_attempts (attempt_hash, success)
    values
        (attempt_hash_value, false),
        (code_attempt_hash_value, false),
        (global_attempt_hash_value, false);
    return jsonb_build_object('ok', false);
end;
$$;

create or replace function public.has_class_record_admin_access()
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
    headers jsonb;
    access_token text;
begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
    access_token := coalesce(headers->>'x-class-record-access', '');
    if length(access_token) <> 64 then
        return false;
    end if;
    return exists (
        select 1
          from public.invite_access_sessions
         where token_hash = public.hash_invite_secret(access_token)
           and access_level = 'admin'
           and revoked_at is null
           and last_seen_at > now() - interval '90 days'
           and expires_at > now()
           and created_at > now() - interval '365 days'
    );
exception when others then
    return false;
end;
$$;

create or replace function public.refresh_invite_access(input_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    target_hash text;
    current_origin_hash text;
    target_session public.invite_access_sessions%rowtype;
    next_window_started_at timestamptz;
    next_refresh_count integer;
    next_risk_flags text[];
    mark_risk boolean := false;
begin
    if input_token is null or length(trim(input_token)) <> 64 then
        return false;
    end if;
    target_hash := public.hash_invite_secret(trim(input_token));
    current_origin_hash := public.invite_request_fingerprint();
    select * into target_session
      from public.invite_access_sessions
     where token_hash = target_hash
       and revoked_at is null
       and last_seen_at > now() - interval '90 days'
       and expires_at > now()
       and created_at > now() - interval '365 days'
     for update;
    if not found then return false; end if;

    next_risk_flags := coalesce(target_session.risk_flags, '{}'::text[]);
    if target_session.refresh_window_started_at is null
       or target_session.refresh_window_started_at <= now() - interval '10 minutes' then
        next_window_started_at := now();
        next_refresh_count := 1;
    else
        next_window_started_at := target_session.refresh_window_started_at;
        next_refresh_count := target_session.refresh_count + 1;
    end if;
    if next_refresh_count > 60 and not ('high_refresh_rate' = any(next_risk_flags)) then
        next_risk_flags := array_append(next_risk_flags, 'high_refresh_rate');
        mark_risk := true;
    end if;
    if target_session.last_origin_hash is not null
       and target_session.last_origin_hash <> current_origin_hash
       and target_session.last_seen_at > now() - interval '5 minutes'
       and not ('rapid_origin_change' = any(next_risk_flags)) then
        next_risk_flags := array_append(next_risk_flags, 'rapid_origin_change');
        mark_risk := true;
    end if;
    update public.invite_access_sessions
       set last_seen_at = now(),
           last_origin_hash = current_origin_hash,
           refresh_window_started_at = next_window_started_at,
           refresh_count = next_refresh_count,
           risk_flags = next_risk_flags,
           risk_flagged_at = case when mark_risk then now() else risk_flagged_at end
     where id = target_session.id;
    return true;
end;
$$;

create or replace function public.has_class_record_access()
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
    headers jsonb;
    access_token text;
begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
    access_token := coalesce(headers->>'x-class-record-access', '');
    if length(access_token) <> 64 then
        return false;
    end if;
    return exists (
        select 1
          from public.invite_access_sessions
         where token_hash = public.hash_invite_secret(access_token)
           and revoked_at is null
           and last_seen_at > now() - interval '90 days'
           and expires_at > now()
           and created_at > now() - interval '365 days'
    );
exception when others then
    return false;
end;
$$;

create or replace function public.revoke_invite_access_session(target_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    revoked_id uuid;
begin
    update public.invite_access_sessions
       set revoked_at = coalesce(revoked_at, now())
     where id = target_session_id
     returning id into revoked_id;
    return revoked_id is not null;
end;
$$;

create or replace function public.revoke_all_invite_access_sessions()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    revoked_count bigint;
begin
    update public.invite_access_sessions
       set revoked_at = now()
     where revoked_at is null;
    get diagnostics revoked_count = row_count;
    return revoked_count;
end;
$$;

create or replace function public.get_invite_access_session_overview()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
    select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where revoked_at is null and last_seen_at > now() - interval '90 days' and expires_at > now() and created_at > now() - interval '365 days'),
        'activeNormal', count(*) filter (where access_level = 'normal' and revoked_at is null and last_seen_at > now() - interval '90 days' and expires_at > now() and created_at > now() - interval '365 days'),
        'activeAdmin', count(*) filter (where access_level = 'admin' and revoked_at is null and last_seen_at > now() - interval '90 days' and expires_at > now() and created_at > now() - interval '365 days'),
        'revoked', count(*) filter (where revoked_at is not null),
        'expired', count(*) filter (where revoked_at is null and (last_seen_at <= now() - interval '90 days' or expires_at <= now() or created_at <= now() - interval '365 days')),
        'riskFlagged', count(*) filter (where cardinality(risk_flags) > 0)
    ) from public.invite_access_sessions;
$$;

create or replace function public.list_invite_access_sessions()
returns table (
    id uuid,
    created_at timestamptz,
    last_used_at timestamptz,
    expires_at timestamptz,
    revoked_at timestamptz,
    access_level text,
    risk_flags text[],
    risk_flagged_at timestamptz,
    recent_refresh_count integer
)
language sql
stable
security definer
set search_path = public, extensions
as $$
    select s.id, s.created_at, s.last_seen_at, s.expires_at, s.revoked_at,
           s.access_level, s.risk_flags, s.risk_flagged_at,
           case when s.refresh_window_started_at > now() - interval '10 minutes' then s.refresh_count else 0 end
      from public.invite_access_sessions s
     order by s.last_seen_at desc;
$$;

create or replace function public.cleanup_invite_code_attempts()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    deleted_count bigint;
begin
    delete from public.invite_code_attempts
     where attempted_at < now() - interval '24 hours';
    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

revoke all on function public.verify_invite_code(text) from public;
grant execute on function public.verify_invite_code(text) to anon, authenticated;
revoke all on function public.invite_request_fingerprint() from public;
revoke all on function public.invite_request_fingerprint() from anon;
revoke all on function public.invite_request_fingerprint() from authenticated;
revoke all on function public.hash_invite_secret(text) from public;
revoke all on function public.hash_invite_secret(text) from anon;
revoke all on function public.hash_invite_secret(text) from authenticated;
revoke all on function public.refresh_invite_access(text) from public;
grant execute on function public.refresh_invite_access(text) to anon, authenticated;
revoke all on function public.has_class_record_access() from public;
grant execute on function public.has_class_record_access() to anon, authenticated;
revoke all on function public.has_class_record_admin_access() from public;
grant execute on function public.has_class_record_admin_access() to anon, authenticated;
revoke all on function public.revoke_invite_access_session(uuid) from public, anon, authenticated;
grant execute on function public.revoke_invite_access_session(uuid) to service_role;
revoke all on function public.revoke_all_invite_access_sessions() from public, anon, authenticated;
grant execute on function public.revoke_all_invite_access_sessions() to service_role;
revoke all on function public.get_invite_access_session_overview() from public, anon, authenticated;
grant execute on function public.get_invite_access_session_overview() to service_role;
revoke all on function public.list_invite_access_sessions() from public, anon, authenticated;
grant execute on function public.list_invite_access_sessions() to service_role;
revoke all on function public.cleanup_invite_code_attempts() from public, anon, authenticated;
grant execute on function public.cleanup_invite_code_attempts() to service_role;

-- ---------------------------------------------------------------------------
-- Content tables read by the frontend
-- ---------------------------------------------------------------------------

create table if not exists public.class_records (
    id bigint generated by default as identity primary key,
    file_name text not null unique,
    record_id text,
    record_index integer,
    record_date text,
    record_time text,
    author text,
    content text,
    importance text,
    hidden boolean not null default false,
    attachments jsonb not null default '[]'::jsonb,
    image_path text,
    raw jsonb not null default '{}'::jsonb
);

create table if not exists public.class_people (
    id text primary key,
    person_id text,
    name text,
    aliases jsonb not null default '[]'::jsonb,
    alias text,
    role text,
    subject text,
    main boolean not null default false,
    bio text,
    avatar_url text,
    raw jsonb not null default '{}'::jsonb
);

-- Keep existing installations compatible when this setup script is rerun.
alter table public.class_people
add column if not exists subject text;

alter table public.class_people
add column if not exists main boolean not null default false;

create table if not exists public.class_record_pages (
    id bigint generated by default as identity primary key,
    page text not null unique,
    start_file text,
    end_file text,
    image_path text,
    hidden boolean not null default false,
    sort_order integer,
    raw jsonb not null default '{}'::jsonb
);

create table if not exists public.class_page_messages (
    id bigint generated by default as identity primary key,
    page text not null unique,
    content text not null,
    author text,
    raw jsonb not null default '{}'::jsonb
);

create table if not exists public.class_page_supplements (
    id bigint generated by default as identity primary key,
    file_name text not null unique,
    page text not null,
    supplement_index integer not null,
    author text,
    content text not null,
    hidden boolean not null default false,
    sort_order integer,
    raw jsonb not null default '{}'::jsonb
);

create index if not exists class_page_supplements_page_idx
on public.class_page_supplements (hidden, page, supplement_index);

create table if not exists public.class_materials (
    id text primary key,
    material_id text,
    title text not null,
    content text not null,
    sort_order integer,
    raw jsonb not null default '{}'::jsonb
);

create table if not exists public.class_quiz_questions (
    id text primary key,
    content_key text,
    question_group text,
    question_type text,
    prompt text,
    choices jsonb not null default '[]'::jsonb,
    answer text,
    explanation text,
    image_path text,
    sort_order integer,
    raw jsonb not null default '{}'::jsonb
);

-- CREATE TABLE IF NOT EXISTS does not update an older table. Keep the
-- migration columns explicit so rerunning this setup upgrades legacy schemas.
alter table public.class_quiz_questions
add column if not exists content_key text;

alter table public.class_quiz_questions
add column if not exists question_group text;

alter table public.class_quiz_questions
add column if not exists question_type text;

alter table public.class_quiz_questions
add column if not exists prompt text;

alter table public.class_quiz_questions
add column if not exists choices jsonb not null default '[]'::jsonb;

alter table public.class_quiz_questions
add column if not exists answer text;

alter table public.class_quiz_questions
add column if not exists explanation text;

alter table public.class_quiz_questions
add column if not exists image_path text;

alter table public.class_quiz_questions
add column if not exists sort_order integer;

alter table public.class_quiz_questions
add column if not exists raw jsonb not null default '{}'::jsonb;

create table if not exists public.class_credits_page (
    id text primary key default 'main',
    title text not null default '制作组与致谢',
    sections jsonb not null default '[]'::jsonb,
    thanks jsonb not null default '[]'::jsonb,
    original_images jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now(),
    raw jsonb not null default '{}'::jsonb,
    constraint class_credits_page_id_check check (id = 'main'),
    constraint class_credits_page_sections_array check (jsonb_typeof(sections) = 'array'),
    constraint class_credits_page_thanks_array check (jsonb_typeof(thanks) = 'array'),
    constraint class_credits_page_original_images_array check (jsonb_typeof(original_images) = 'array')
);

alter table public.class_records enable row level security;
alter table public.class_people enable row level security;
alter table public.class_record_pages enable row level security;
alter table public.class_page_messages enable row level security;
alter table public.class_page_supplements enable row level security;
alter table public.class_materials enable row level security;
alter table public.class_quiz_questions enable row level security;
alter table public.class_credits_page enable row level security;

do $$
declare
    item record;
begin
    for item in
        select
            n.nspname as schema_name,
            c.relname as table_name,
            p.polname as policy_name
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in (
              'class_records',
              'class_people',
              'class_record_pages',
              'class_page_messages',
              'class_page_supplements',
              'class_materials',
              'class_quiz_questions',
              'class_credits_page'
          )
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            item.policy_name,
            item.schema_name,
            item.table_name
        );
    end loop;
end;
$$;

-- Establish a least-privilege table baseline on every rerun. RLS remains the
-- row-level guard, while grants prevent old write policies from becoming an
-- accidental write path for frontend roles.
revoke all on public.class_records from public, anon, authenticated;
revoke all on public.class_people from public, anon, authenticated;
revoke all on public.class_record_pages from public, anon, authenticated;
revoke all on public.class_page_messages from public, anon, authenticated;
revoke all on public.class_page_supplements from public, anon, authenticated;
revoke all on public.class_materials from public, anon, authenticated;
revoke all on public.class_quiz_questions from public, anon, authenticated;
revoke all on public.class_credits_page from public, anon, authenticated;

grant select on public.class_records to anon, authenticated;
grant select on public.class_people to anon, authenticated;
grant select on public.class_record_pages to anon, authenticated;
grant select on public.class_page_messages to anon, authenticated;
grant select on public.class_page_supplements to anon, authenticated;
grant select on public.class_materials to anon, authenticated;
grant select on public.class_quiz_questions to anon, authenticated;
grant select on public.class_credits_page to anon, authenticated;

drop policy if exists "class_records_read" on public.class_records;
create policy "class_records_read"
on public.class_records for select
to anon, authenticated
using (public.has_class_record_access() and (hidden = false or public.has_class_record_admin_access()));

drop policy if exists "class_people_read" on public.class_people;
create policy "class_people_read"
on public.class_people for select
to anon, authenticated
using (public.has_class_record_access());

drop policy if exists "class_record_pages_read" on public.class_record_pages;
create policy "class_record_pages_read"
on public.class_record_pages for select
to anon, authenticated
using (public.has_class_record_access() and (hidden = false or public.has_class_record_admin_access()));

drop policy if exists "class_page_messages_read" on public.class_page_messages;
create policy "class_page_messages_read"
on public.class_page_messages for select
to anon, authenticated
using (public.has_class_record_access());

drop policy if exists "class_page_supplements_read" on public.class_page_supplements;
create policy "class_page_supplements_read"
on public.class_page_supplements for select
to anon, authenticated
using (public.has_class_record_access() and (hidden = false or public.has_class_record_admin_access()));

drop policy if exists "class_materials_read" on public.class_materials;
create policy "class_materials_read"
on public.class_materials for select
to anon, authenticated
using (public.has_class_record_access());

drop policy if exists "class_quiz_questions_read" on public.class_quiz_questions;
create policy "class_quiz_questions_read"
on public.class_quiz_questions for select
to anon, authenticated
using (
    public.has_class_record_access()
    and public.has_class_record_admin_access()
);

drop policy if exists "class_credits_page_read" on public.class_credits_page;
create policy "class_credits_page_read"
on public.class_credits_page for select
to anon, authenticated
using (public.has_class_record_access());

-- ---------------------------------------------------------------------------
-- Storage signed URL support
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('classrecord-private', 'classrecord-private', false)
on conflict (id) do update
set public = false;

do $$
declare
    item record;
begin
    for item in
        select
            p.polname as policy_name
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

-- This project intentionally keeps exactly one policy on storage.objects.
-- PostgreSQL combines permissive policies with OR, so leaving any historical
-- SELECT policy in place could bypass the invite check. Frontend uploads are
-- not supported, so old write policies are removed as well.
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
    )
);

-- Refresh Supabase PostgREST schema cache so /rpc/verify_invite_code appears.
notify pgrst, 'reload schema';

