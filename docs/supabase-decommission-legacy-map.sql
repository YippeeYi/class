-- One-time decommission of the retired map feature.
-- Run in the Supabase SQL Editor with a project-owner role after deploying
-- the code removal. It is safe to run repeatedly.

begin;

-- Supabase blocks direct deletion from storage.objects. Clear the retired
-- `images/admissions/` prefix through the Storage API before running this
-- script; the project's verified decommission run has already done so.

-- These tables own all retired rows, their RLS policies, constraints, and
-- indexes. CASCADE also removes foreign-key dependencies if a prior install
-- used a variant of the original migration.
drop table if exists public.class_admissions cascade;
drop table if exists public.class_universities cascade;

-- Remove the browser RPC and the shared timestamp helper created for the
-- retired tables. The latter is not used by any remaining schema object.
drop function if exists public.get_class_admission_map();
drop function if exists public.class_admissions_set_updated_at();

-- Restore the sole Storage read policy to the current deployable asset roots.
drop policy if exists "classrecord_private_read" on storage.objects;
create policy "classrecord_private_read"
on storage.objects for select
to anon, authenticated
using (
    bucket_id = 'classrecord-private'
    and public.has_class_record_access()
    and (
        (
            name !~ '^hidden/'
            and name ~ '^(data/attachments/|images/record-pages/).+\.(png|jpe?g|webp|gif|svg|pdf|txt|zip|mp3|wav|ogg|mp4|webm)$'
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

notify pgrst, 'reload schema';
commit;
