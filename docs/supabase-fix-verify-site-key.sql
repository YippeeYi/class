-- Fix verify_site_key when Supabase reports:
-- ERROR: function digest(text, unknown) does not exist
--
-- Run this in Supabase SQL Editor. It only recreates the RPC and refreshes
-- PostgREST schema cache; it does not change your keys or content tables.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_site_key(input_key text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    if input_key is null or length(trim(input_key)) = 0 then
        return false;
    end if;

    return exists (
        select 1
        from public.site_access_keys
        where active = true
          and key_hash = encode(extensions.digest(convert_to(trim(input_key), 'UTF8'), 'sha256'), 'hex')
    );
end;
$$;

revoke all on function public.verify_site_key(text) from public;
grant execute on function public.verify_site_key(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Optional direct test. Replace the placeholder with your real key.
-- select public.verify_site_key('REPLACE_WITH_YOUR_SITE_KEY') as key_is_valid;
