-- One-time invite code access.
-- Run this in Supabase SQL Editor.
--
-- Required secret:
--   insert into public.invite_code_settings (id, pepper)
--   values (1, 'replace-with-a-long-random-secret')
--   on conflict (id) do update set pepper = excluded.pepper, updated_at = now();

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

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
    note text
);

create table if not exists public.invite_access_sessions (
    id uuid primary key default gen_random_uuid(),
    token_hash text not null unique,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    revoked_at timestamptz
);

alter table public.invite_codes enable row level security;
alter table public.invite_access_sessions enable row level security;
alter table public.invite_code_settings enable row level security;
revoke all on public.invite_codes from anon, authenticated;
revoke all on public.invite_access_sessions from anon, authenticated;
revoke all on public.invite_code_settings from anon, authenticated;

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

create or replace function public.verify_invite_code(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    normalized_code text := upper(regexp_replace(trim(coalesce(input_code, '')), '\s+', '', 'g'));
    target_hash text;
    consumed_id uuid;
    existing public.invite_codes%rowtype;
    access_token text;
begin
    if normalized_code = '' then
        return jsonb_build_object('ok', false, 'reason', 'empty');
    end if;

    target_hash := public.hash_invite_secret(normalized_code);

    update public.invite_codes
       set used = true,
           used_at = now()
     where code_hash = target_hash
       and used = false
       and (expires_at is null or expires_at > now())
     returning id into consumed_id;

    if consumed_id is not null then
        access_token := encode(extensions.gen_random_bytes(32), 'hex');
        insert into public.invite_access_sessions (token_hash)
        values (public.hash_invite_secret(access_token));
        return jsonb_build_object('ok', true, 'accessToken', access_token);
    end if;

    select *
      into existing
      from public.invite_codes
     where code_hash = target_hash
     limit 1;

    if not found then
        return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;

    if existing.used then
        return jsonb_build_object('ok', false, 'reason', 'used');
    end if;

    if existing.expires_at is not null and existing.expires_at <= now() then
        return jsonb_build_object('ok', false, 'reason', 'expired');
    end if;

    return jsonb_build_object('ok', false, 'reason', 'invalid');
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
    refreshed_id uuid;
begin
    if input_token is null or length(trim(input_token)) < 32 then
        return false;
    end if;
    target_hash := public.hash_invite_secret(trim(input_token));
    update public.invite_access_sessions
       set last_seen_at = now()
     where token_hash = target_hash
       and revoked_at is null
       and last_seen_at > now() - interval '30 days'
     returning id into refreshed_id;
    return refreshed_id is not null;
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
    if length(access_token) < 32 then
        return false;
    end if;
    return exists (
        select 1
          from public.invite_access_sessions
         where token_hash = public.hash_invite_secret(access_token)
           and revoked_at is null
           and last_seen_at > now() - interval '30 days'
    );
exception when others then
    return false;
end;
$$;

revoke all on function public.verify_invite_code(text) from public;
grant execute on function public.verify_invite_code(text) to anon, authenticated;
revoke all on function public.refresh_invite_access(text) from public;
grant execute on function public.refresh_invite_access(text) to anon, authenticated;
revoke all on function public.has_class_record_access() from public;
grant execute on function public.has_class_record_access() to anon, authenticated;

-- Apply this predicate to every sensitive content table policy, for example:
-- create policy "class_records_read" on public.class_records for select
-- to anon, authenticated using (public.has_class_record_access());
-- For Storage:
-- create policy "classrecord_private_read" on storage.objects for select
-- to anon, authenticated using (bucket_id = 'classrecord-private' and public.has_class_record_access());

notify pgrst, 'reload schema';
