-- Hidden mode is reserved for ordinary class_records. Page messages and page
-- supplements are public written-page context for every valid archive session.
-- Normalize rows created by the short-lived hidden-auxiliary implementation
-- without dropping compatibility columns that older publishers may still send.

do $$
begin
    if exists (
        select 1
        from public.class_page_messages hidden_message
        join public.class_page_messages public_message
          on public_message.page = substring(hidden_message.page from 2)
         and public_message.id <> hidden_message.id
        where hidden_message.page ~ '^H[0-9]+$'
    ) then
        raise exception 'Cannot normalize hidden page messages: target page already exists';
    end if;
end;
$$;

update public.class_page_messages
set
    page = case when page ~ '^H[0-9]+$' then substring(page from 2) else page end,
    hidden = false,
    raw = case
        when raw ? 'page' then jsonb_set(raw - 'hidden', '{page}', to_jsonb(case when page ~ '^H[0-9]+$' then substring(page from 2) else page end), true)
        else raw - 'hidden'
    end
where hidden = true or page ~ '^H[0-9]+$' or raw ->> 'hidden' = 'true';

update public.class_page_supplements
set
    page = case when page ~ '^H[0-9]+$' then substring(page from 2) else page end,
    hidden = false,
    raw = case
        when raw ? 'page' then jsonb_set(raw - 'hidden', '{page}', to_jsonb(case when page ~ '^H[0-9]+$' then substring(page from 2) else page end), true)
        else raw - 'hidden'
    end
where hidden = true or page ~ '^H[0-9]+$' or raw ->> 'hidden' = 'true';

drop index if exists public.class_page_messages_hidden_page_idx;
drop index if exists public.class_page_supplements_page_idx;
create index if not exists class_page_supplements_page_idx
on public.class_page_supplements (page, supplement_index);

drop policy if exists "class_page_messages_read" on public.class_page_messages;
create policy "class_page_messages_read"
on public.class_page_messages for select
to anon, authenticated
using (public.has_class_record_access());

drop policy if exists "class_page_supplements_read" on public.class_page_supplements;
create policy "class_page_supplements_read"
on public.class_page_supplements for select
to anon, authenticated
using (public.has_class_record_access());
