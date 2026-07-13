-- Phase 2 incremental security migration for an existing installation.
-- Run once in Supabase SQL Editor, then run supabase-security-check.sql.

create index if not exists invite_code_attempts_cleanup_idx
on public.invite_code_attempts (attempted_at);

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

    select count(*)::integer into recent_failures
      from public.invite_code_attempts
     where attempt_hash = attempt_hash_value
       and success = false
       and attempted_at > now() - interval '15 minutes';

    select count(*)::integer into recent_code_failures
      from public.invite_code_attempts
     where attempt_hash = code_attempt_hash_value
       and success = false
       and attempted_at > now() - interval '30 minutes';

    select count(*)::integer into recent_global_attempts
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
       set used = true, used_at = now()
     where code_hash = target_hash
       and used = false
       and (expires_at is null or expires_at > now())
     returning access_level into consumed_access_level;

    if consumed_access_level is not null then
        access_token := encode(extensions.gen_random_bytes(32), 'hex');
        insert into public.invite_access_sessions (token_hash, access_level)
        values (public.hash_invite_secret(access_token), consumed_access_level);
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
    if input_token is null or length(trim(input_token)) <> 64 then return false; end if;
    target_hash := public.hash_invite_secret(trim(input_token));
    update public.invite_access_sessions
       set last_seen_at = now()
     where token_hash = target_hash
       and revoked_at is null
       and last_seen_at > now() - interval '90 days'
       and created_at > now() - interval '365 days'
     returning id into refreshed_id;
    return refreshed_id is not null;
end;
$$;

create or replace function public.has_class_record_access()
returns boolean
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare headers jsonb; access_token text;
begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
    access_token := coalesce(headers->>'x-class-record-access', '');
    if length(access_token) <> 64 then return false; end if;
    return exists (
        select 1 from public.invite_access_sessions
         where token_hash = public.hash_invite_secret(access_token)
           and revoked_at is null
           and last_seen_at > now() - interval '90 days'
           and created_at > now() - interval '365 days'
    );
exception when others then return false;
end;
$$;

create or replace function public.has_class_record_admin_access()
returns boolean
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare headers jsonb; access_token text;
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
           and created_at > now() - interval '365 days'
    );
exception when others then return false;
end;
$$;

create or replace function public.revoke_invite_access_session(target_session_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, extensions
as $$
declare revoked_id uuid;
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
language plpgsql security definer
set search_path = public, extensions
as $$
declare revoked_count bigint;
begin
    update public.invite_access_sessions set revoked_at = now() where revoked_at is null;
    get diagnostics revoked_count = row_count;
    return revoked_count;
end;
$$;

create or replace function public.cleanup_invite_code_attempts()
returns bigint
language plpgsql security definer
set search_path = public, extensions
as $$
declare deleted_count bigint;
begin
    delete from public.invite_code_attempts where attempted_at < now() - interval '24 hours';
    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

revoke all on function public.invite_request_fingerprint() from public, anon, authenticated;
revoke all on function public.verify_invite_code(text) from public;
grant execute on function public.verify_invite_code(text) to anon, authenticated;
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
revoke all on function public.cleanup_invite_code_attempts() from public, anon, authenticated;
grant execute on function public.cleanup_invite_code_attempts() to service_role;

notify pgrst, 'reload schema';

-- Schedule separately in Supabase Cron (once per day):
-- select public.cleanup_invite_code_attempts();
