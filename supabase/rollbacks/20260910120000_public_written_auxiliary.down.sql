-- Restore the former schema-compatible policies. Rows intentionally remain
-- public because a rollback must not guess which auxiliary prose was once
-- classified as hidden.
drop index if exists public.class_page_supplements_page_idx;
create index if not exists class_page_supplements_page_idx
on public.class_page_supplements (hidden, page, supplement_index);

create index if not exists class_page_messages_hidden_page_idx
on public.class_page_messages (hidden, page);

drop policy if exists "class_page_messages_read" on public.class_page_messages;
create policy "class_page_messages_read"
on public.class_page_messages for select
to anon, authenticated
using (public.has_class_record_access() and (hidden = false or public.has_class_record_admin_access()));

drop policy if exists "class_page_supplements_read" on public.class_page_supplements;
create policy "class_page_supplements_read"
on public.class_page_supplements for select
to anon, authenticated
using (public.has_class_record_access() and (hidden = false or public.has_class_record_admin_access()));
