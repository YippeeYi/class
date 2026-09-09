-- Restore the former read policy. The hidden column and its data are retained so
-- an emergency rollback cannot silently publish or destroy reviewed privacy state.
drop policy if exists "class_page_messages_read" on public.class_page_messages;
create policy "class_page_messages_read"
on public.class_page_messages for select
to anon, authenticated
using (public.has_class_record_access());

drop index if exists public.class_page_messages_hidden_page_idx;
