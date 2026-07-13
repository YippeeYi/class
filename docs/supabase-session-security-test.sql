-- Transactional session lifetime/revocation test. It leaves no rows behind.
-- Run after supabase-phase2-security.sql in Supabase SQL Editor.

begin;

create temporary table security_test_token(raw_token text not null) on commit drop;
insert into security_test_token
values (encode(extensions.gen_random_bytes(32), 'hex'));

insert into public.invite_access_sessions (token_hash, access_level)
select public.hash_invite_secret(raw_token), 'normal'
from security_test_token;

do $$
begin
    perform set_config(
        'request.headers',
        jsonb_build_object(
            'x-class-record-access', (select raw_token from security_test_token),
            'x-real-ip', '127.0.0.1'
        )::text,
        true
    );
end;
$$;

select
    'active_session' as check_item,
    case when public.has_class_record_access() then 'PASS' else 'FAIL' end as result;

update public.invite_access_sessions
set last_seen_at = now() - interval '91 days'
where token_hash = public.hash_invite_secret((select raw_token from security_test_token));

select
    'idle_expiry' as check_item,
    case when not public.has_class_record_access() then 'PASS' else 'FAIL' end as result;

update public.invite_access_sessions
set last_seen_at = now(), created_at = now() - interval '366 days'
where token_hash = public.hash_invite_secret((select raw_token from security_test_token));

select
    'absolute_expiry' as check_item,
    case when not public.has_class_record_access() then 'PASS' else 'FAIL' end as result;

update public.invite_access_sessions
set created_at = now(), revoked_at = now()
where token_hash = public.hash_invite_secret((select raw_token from security_test_token));

select
    'revocation' as check_item,
    case when not public.has_class_record_access() then 'PASS' else 'FAIL' end as result;

rollback;
