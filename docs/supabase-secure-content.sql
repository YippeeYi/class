-- ClassRecord secure content schema
-- 在 Supabase SQL Editor 执行。本文件可重复执行。

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('classrecord-private', 'classrecord-private', false)
on conflict (id) do update set public = false;

create table if not exists public.class_records (
    file_name text primary key,
    record_id text,
    record_date date,
    record_time text,
    author text,
    content text not null default '',
    importance text not null default 'normal',
    attachments jsonb not null default '[]'::jsonb,
    record_index integer not null default 0,
    raw jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.class_people (
    id text primary key,
    alias text not null default '',
    role text not null default 'student',
    bio text not null default '',
    sort_order integer not null default 0,
    raw jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.class_glossary (
    id text primary key,
    label text,
    definition text not null default '',
    sort_order integer not null default 0,
    raw jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.class_record_pages (
    page text primary key,
    start_file text,
    end_file text,
    sort_order integer not null default 0,
    raw jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.class_quiz_questions (
    id text primary key,
    question_group text not null,
    prompt text,
    answer text not null,
    image_path text,
    sort_order integer not null default 0,
    raw jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create index if not exists class_records_record_index_idx on public.class_records (record_index);
create index if not exists class_records_record_date_idx on public.class_records (record_date);
create index if not exists class_people_sort_order_idx on public.class_people (sort_order);
create index if not exists class_glossary_sort_order_idx on public.class_glossary (sort_order);
create index if not exists class_quiz_questions_group_order_idx on public.class_quiz_questions (question_group, sort_order);
create table if not exists public.class_user_state (
    user_id uuid primary key references auth.users(id) on delete cascade,
    achievement_state jsonb not null default '{}'::jsonb,
    qcoin_state jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.class_user_state enable row level security;

drop policy if exists "class_user_state_select_self" on public.class_user_state;
create policy "class_user_state_select_self" on public.class_user_state for select to authenticated using (auth.uid() = user_id);

drop policy if exists "class_user_state_insert_self" on public.class_user_state;
create policy "class_user_state_insert_self" on public.class_user_state for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "class_user_state_update_self" on public.class_user_state;
create policy "class_user_state_update_self" on public.class_user_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.class_records enable row level security;
alter table public.class_people enable row level security;
alter table public.class_glossary enable row level security;
alter table public.class_record_pages enable row level security;
alter table public.class_quiz_questions enable row level security;

drop policy if exists "class_records_select_authenticated" on public.class_records;
create policy "class_records_select_authenticated" on public.class_records for select to authenticated using (true);

drop policy if exists "class_people_select_authenticated" on public.class_people;
create policy "class_people_select_authenticated" on public.class_people for select to authenticated using (true);

drop policy if exists "class_glossary_select_authenticated" on public.class_glossary;
create policy "class_glossary_select_authenticated" on public.class_glossary for select to authenticated using (true);

drop policy if exists "class_record_pages_select_authenticated" on public.class_record_pages;
create policy "class_record_pages_select_authenticated" on public.class_record_pages for select to authenticated using (true);

drop policy if exists "class_quiz_questions_select_authenticated" on public.class_quiz_questions;
create policy "class_quiz_questions_select_authenticated" on public.class_quiz_questions for select to authenticated using (true);

drop policy if exists "private_assets_select_authenticated" on storage.objects;
create policy "private_assets_select_authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'classrecord-private');

create or replace function public.get_record_interaction_summaries(record_keys text[])
returns table (
    record_key text,
    like_count bigint,
    favorite_count bigint,
    comment_count bigint,
    my_liked boolean,
    my_favorited boolean
)
language sql
stable
security definer
set search_path = public
as $$
    with keys as (
        select distinct unnest(record_keys) as record_key
    ), reaction_counts as (
        select
            rr.record_key,
            count(*) filter (where rr.type = 'like') as like_count,
            count(*) filter (where rr.type = 'favorite') as favorite_count,
            bool_or(rr.type = 'like' and rr.user_id = auth.uid()) as my_liked,
            bool_or(rr.type = 'favorite' and rr.user_id = auth.uid()) as my_favorited
        from public.record_reactions rr
        where rr.record_key = any(record_keys)
        group by rr.record_key
    ), comment_counts as (
        select rc.record_key, count(*) as comment_count
        from public.record_comments rc
        where rc.record_key = any(record_keys)
        group by rc.record_key
    )
    select
        keys.record_key,
        coalesce(reaction_counts.like_count, 0),
        coalesce(reaction_counts.favorite_count, 0),
        coalesce(comment_counts.comment_count, 0),
        coalesce(reaction_counts.my_liked, false),
        coalesce(reaction_counts.my_favorited, false)
    from keys
    left join reaction_counts using (record_key)
    left join comment_counts using (record_key);
$$;

grant execute on function public.get_record_interaction_summaries(text[]) to authenticated;
