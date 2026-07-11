-- Add secure backend storage for the credits/thanks page.
-- Execute in Supabase SQL Editor after docs/supabase-setup.sql has been applied.

create table if not exists public.class_credits_page (
    id text primary key default 'main',
    title text not null default '制作组与致谢',
    sections jsonb not null default '[]'::jsonb,
    thanks jsonb not null default '[]'::jsonb,
    original_images jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now(),
    raw jsonb not null default '{}'::jsonb,
    constraint class_credits_page_id_check check (id = 'main'),
    constraint class_credits_page_sections_array check (jsonb_typeof(sections) = 'array'),
    constraint class_credits_page_thanks_array check (jsonb_typeof(thanks) = 'array'),
    constraint class_credits_page_original_images_array check (jsonb_typeof(original_images) = 'array')
);

alter table public.class_credits_page enable row level security;

drop policy if exists "class_credits_page_read" on public.class_credits_page;
create policy "class_credits_page_read"
on public.class_credits_page for select
to anon, authenticated
using (public.has_class_record_access());

insert into storage.buckets (id, name, public)
values ('classrecord-private', 'classrecord-private', false)
on conflict (id) do update
set public = false;

drop policy if exists "classrecord_private_read" on storage.objects;
create policy "classrecord_private_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'classrecord-private' and public.has_class_record_access());

notify pgrst, 'reload schema';

-- Example data shape. Replace all placeholder text before executing.
-- Keep image files in the private bucket under data/attachments/.
/*
insert into public.class_credits_page (
    id,
    title,
    sections,
    thanks,
    original_images,
    raw,
    updated_at
) values (
    'main',
    '制作组与致谢',
    '[
        {
            "id": "records",
            "title": "书面记录",
            "members": [
                "总主编：[[person:person_id|显示名]]",
                "主编：[[person:person_id_2|显示名]]"
            ]
        },
        {
            "id": "website",
            "title": "网站制作",
            "members": [
                "制作：[[person:person_id|显示名]]"
            ]
        }
    ]'::jsonb,
    '[
        "感谢 [[person:person_id|显示名]] 对内容校准的支持。"
    ]'::jsonb,
    '[
        {
            "id": "original-01",
            "title": "原始记录图片一",
            "content": "原始记录图片一：[[illu:credits-original-01.jpg|查看图片]]"
        }
    ]'::jsonb,
    '{}'::jsonb,
    now()
) on conflict (id) do update set
    title = excluded.title,
    sections = excluded.sections,
    thanks = excluded.thanks,
    original_images = excluded.original_images,
    raw = excluded.raw,
    updated_at = now();
*/
