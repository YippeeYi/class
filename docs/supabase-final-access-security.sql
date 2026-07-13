-- Final access-token hardening for an existing installation.
-- Run once in Supabase SQL Editor, then run supabase-security-check.sql.
-- This migration does not store raw IP addresses, regions, User-Agent values,
-- or original bearer tokens. Anomaly flags are informational and never block.

alter table public.invite_access_sessions
add column if not exists expires_at timestamptz;

update public.invite_access_sessions
set expires_at = created_at + interval '365 days'
where expires_at is null;

alter table public.invite_access_sessions
alter column expires_at set default (now() + interval '365 days');

alter table public.invite_access_sessions
alter column expires_at set not null;

alter table public.invite_access_sessions
add column if not exists last_origin_hash text;

alter table public.invite_access_sessions
add column if not exists refresh_window_started_at timestamptz;

alter table public.invite_access_sessions
add column if not exists refresh_count integer not null default 0;

alter table public.invite_access_sessions
add column if not exists risk_flags text[] not null default '{}'::text[];

alter table public.invite_access_sessions
add column if not exists risk_flagged_at timestamptz;

alter table public.invite_access_sessions
drop constraint if exists invite_access_sessions_token_hash_format_check;

alter table public.invite_access_sessions
add constraint invite_access_sessions_token_hash_format_check
check (token_hash ~ '^[0-9a-f]{64}$');

create index if not exists invite_access_sessions_active_idx
on public.invite_access_sessions (revoked_at, expires_at, last_seen_at);

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

    if not found then
        return false;
    end if;

    next_risk_flags := coalesce(target_session.risk_flags, '{}'::text[]);
    if target_session.refresh_window_started_at is null
       or target_session.refresh_window_started_at <= now() - interval '10 minutes' then
        next_window_started_at := now();
        next_refresh_count := 1;
    else
        next_window_started_at := target_session.refresh_window_started_at;
        next_refresh_count := target_session.refresh_count + 1;
    end if;

    if next_refresh_count > 60
       and not ('high_refresh_rate' = any(next_risk_flags)) then
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
    if length(access_token) <> 64 then return false; end if;
    return exists (
        select 1 from public.invite_access_sessions
         where token_hash = public.hash_invite_secret(access_token)
           and revoked_at is null
           and last_seen_at > now() - interval '90 days'
           and expires_at > now()
           and created_at > now() - interval '365 days'
    );
exception when others then return false;
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
    if length(access_token) <> 64 then return false; end if;
    return exists (
        select 1 from public.invite_access_sessions
         where token_hash = public.hash_invite_secret(access_token)
           and access_level = 'admin'
           and revoked_at is null
           and last_seen_at > now() - interval '90 days'
           and expires_at > now()
           and created_at > now() - interval '365 days'
    );
exception when others then return false;
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
        'active', count(*) filter (
            where revoked_at is null
              and last_seen_at > now() - interval '90 days'
              and expires_at > now() and created_at > now() - interval '365 days'
        ),
        'activeNormal', count(*) filter (
            where access_level = 'normal' and revoked_at is null
              and last_seen_at > now() - interval '90 days' and expires_at > now()
              and created_at > now() - interval '365 days'
        ),
        'activeAdmin', count(*) filter (
            where access_level = 'admin' and revoked_at is null
              and last_seen_at > now() - interval '90 days' and expires_at > now()
              and created_at > now() - interval '365 days'
        ),
        'revoked', count(*) filter (where revoked_at is not null),
        'expired', count(*) filter (
            where revoked_at is null
              and (last_seen_at <= now() - interval '90 days' or expires_at <= now()
                   or created_at <= now() - interval '365 days')
        ),
        'riskFlagged', count(*) filter (where cardinality(risk_flags) > 0)
    )
    from public.invite_access_sessions;
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
           case when s.refresh_window_started_at > now() - interval '10 minutes'
                then s.refresh_count else 0 end
      from public.invite_access_sessions s
     order by s.last_seen_at desc;
$$;

revoke all on function public.refresh_invite_access(text) from public;
grant execute on function public.refresh_invite_access(text) to anon, authenticated;
revoke all on function public.has_class_record_access() from public;
grant execute on function public.has_class_record_access() to anon, authenticated;
revoke all on function public.has_class_record_admin_access() from public;
grant execute on function public.has_class_record_admin_access() to anon, authenticated;
revoke all on function public.get_invite_access_session_overview() from public, anon, authenticated;
grant execute on function public.get_invite_access_session_overview() to service_role;
revoke all on function public.list_invite_access_sessions() from public, anon, authenticated;
grant execute on function public.list_invite_access_sessions() to service_role;

notify pgrst, 'reload schema';
