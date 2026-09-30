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
