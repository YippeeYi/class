-- Original scan pages can contain protected handwriting outside the public
-- record rows. The complete written interface is therefore administrator-only;
-- UI gating is backed by table and Storage RLS rather than treated as security.

update public.class_record_pages
set raw = raw - 'privacyMasks'
where raw ? 'privacyMasks';

-- Remove Hxx rows that existed only to conceal a proverb or supplement. Every
-- retained protected page must map at least one ordinary hidden record.
delete from public.class_record_pages protected_page
where protected_page.hidden = true
  and not exists (
      select 1
      from public.class_records protected_record
      where protected_record.hidden = true
        and protected_page.start_file is not null
        and protected_page.end_file is not null
        and protected_record.file_name between
            least(protected_page.start_file, protected_page.end_file)
            and greatest(protected_page.start_file, protected_page.end_file)
  );

drop policy if exists "class_record_pages_read" on public.class_record_pages;
create policy "class_record_pages_read"
on public.class_record_pages for select
to anon, authenticated
using (public.has_class_record_access() and public.has_class_record_admin_access());

drop policy if exists "classrecord_private_read" on storage.objects;
create policy "classrecord_private_read"
on storage.objects for select
to anon, authenticated
using (
    bucket_id = 'classrecord-private'
    and public.has_class_record_access()
    and (
        name ~ '^data/attachments/.+\.(png|jpe?g|webp|gif|svg|pdf|txt|zip|mp3|wav|ogg|mp4|webm)$'
        or (
            name ~ '^images/record-pages/.+\.(png|jpe?g|webp|gif|svg)$'
            and public.has_class_record_admin_access()
        )
        or (
            name ~ '^images/quiz/.+\.(png|jpe?g|webp|gif|svg)$'
            and public.has_class_record_admin_access()
        )
        or (
            name ~ '^hidden/(data/attachments/|images/record-pages/).+\.(png|jpe?g|webp|gif|svg|pdf|txt|zip|mp3|wav|ogg|mp4|webm)$'
            and public.has_class_record_admin_access()
        )
        or name = 'images/private/meal-map.png'
    )
);
