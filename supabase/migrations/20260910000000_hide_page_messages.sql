-- Extend the established hidden-record policy to page messages (the handwritten
-- page header commonly called a “message” or “motto”). Existing rows remain
-- public until the audited content importer explicitly marks them hidden.
alter table public.class_page_messages
add column if not exists hidden boolean not null default false;

create index if not exists class_page_messages_hidden_page_idx
on public.class_page_messages (hidden, page);

drop policy if exists "class_page_messages_read" on public.class_page_messages;
create policy "class_page_messages_read"
on public.class_page_messages for select
to anon, authenticated
using (public.has_class_record_access() and (hidden = false or public.has_class_record_admin_access()));
