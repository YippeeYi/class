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

-- Phase 1 additions: profiles, hidden records, review queues, wall messages.
-- Execute this after the previous setup files. It is safe to rerun.

alter table public.profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
update public.profiles set user_id = id where user_id is null;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user', 'admin'));
alter table public.profiles add column if not exists coins integer not null default 0;
alter table public.profiles add column if not exists owned_backgrounds jsonb not null default '["default"]'::jsonb;
alter table public.profiles add column if not exists active_background text not null default 'default';
alter table public.profiles add column if not exists quiz_count integer not null default 0;
alter table public.profiles add column if not exists favorite_record_ids jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists achievement_progress jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists achievement_hovered_state jsonb not null default '{}'::jsonb;

alter table public.class_records add column if not exists hidden boolean not null default false;
alter table public.class_records add column if not exists image_path text;
create index if not exists class_records_hidden_index_idx on public.class_records (hidden, record_index);

alter table public.class_record_pages add column if not exists hidden boolean not null default false;
alter table public.class_record_pages add column if not exists image_path text;
create index if not exists class_record_pages_hidden_order_idx on public.class_record_pages (hidden, sort_order);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
    );
$$;

grant execute on function public.is_admin() to authenticated;

create table if not exists public.correction_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    user_email text,
    author_name text,
    target_type text not null check (target_type in ('record', 'person', 'term')),
    target_id text not null,
    description text not null check (char_length(description) between 1 and 1000),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    review_note text,
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.wall_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    user_email text,
    author_name text,
    display_name text,
    is_anonymous boolean not null default false,
    body text not null check (char_length(body) between 1 and 240),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    review_note text,
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.person_claim_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    user_email text,
    author_name text,
    person_id text not null references public.class_people(id) on delete cascade,
    note text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    review_note text,
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.person_edit_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    user_email text,
    author_name text,
    person_id text not null references public.class_people(id) on delete cascade,
    requested_display_name text,
    requested_alias text,
    requested_bio text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    review_note text,
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists correction_requests_user_status_idx on public.correction_requests (user_id, status, created_at desc);
create index if not exists wall_messages_status_created_idx on public.wall_messages (status, created_at desc);
create index if not exists person_claim_requests_person_status_idx on public.person_claim_requests (person_id, status, created_at desc);
create index if not exists person_edit_requests_person_status_idx on public.person_edit_requests (person_id, status, created_at desc);

alter table public.correction_requests enable row level security;
alter table public.wall_messages enable row level security;
alter table public.person_claim_requests enable row level security;
alter table public.person_edit_requests enable row level security;

drop policy if exists "correction_select_own_or_admin" on public.correction_requests;
create policy "correction_select_own_or_admin" on public.correction_requests for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "correction_insert_own" on public.correction_requests;
create policy "correction_insert_own" on public.correction_requests for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "correction_update_admin" on public.correction_requests;
create policy "correction_update_admin" on public.correction_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "wall_select_approved_own_or_admin" on public.wall_messages;
create policy "wall_select_approved_own_or_admin" on public.wall_messages for select to authenticated using (status = 'approved' or auth.uid() = user_id or public.is_admin());
drop policy if exists "wall_insert_own" on public.wall_messages;
create policy "wall_insert_own" on public.wall_messages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "wall_update_admin" on public.wall_messages;
create policy "wall_update_admin" on public.wall_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "claim_select_own_or_admin" on public.person_claim_requests;
create policy "claim_select_own_or_admin" on public.person_claim_requests for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "claim_insert_own" on public.person_claim_requests;
create policy "claim_insert_own" on public.person_claim_requests for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "claim_update_admin" on public.person_claim_requests;
create policy "claim_update_admin" on public.person_claim_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "person_edit_select_own_or_admin" on public.person_edit_requests;
create policy "person_edit_select_own_or_admin" on public.person_edit_requests for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "person_edit_insert_own" on public.person_edit_requests;
create policy "person_edit_insert_own" on public.person_edit_requests for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "person_edit_update_admin" on public.person_edit_requests;
create policy "person_edit_update_admin" on public.person_edit_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Phase 1 person claim write-through fields
alter table if exists public.class_people
    add column if not exists claimed_by uuid references auth.users(id) on delete set null,
    add column if not exists claimed_at timestamptz;

create index if not exists idx_class_people_claimed_by on public.class_people(claimed_by);

alter table if exists public.class_people
    add column if not exists display_name text,
    add column if not exists aliases jsonb not null default '[]'::jsonb;
