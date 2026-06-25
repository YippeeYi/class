-- ClassRecord Supabase schema
-- 在 Supabase SQL Editor 中执行。执行前请确认使用的是目标项目。

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique,
    display_name text,
    updated_at timestamptz not null default now()
);

create table if not exists public.record_reactions (
    id uuid primary key default gen_random_uuid(),
    record_key text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null check (type in ('like', 'favorite')),
    created_at timestamptz not null default now(),
    unique (record_key, user_id, type)
);

create table if not exists public.record_comments (
    id uuid primary key default gen_random_uuid(),
    record_key text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    body text not null check (char_length(body) between 1 and 500),
    author_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists record_reactions_record_key_idx on public.record_reactions (record_key);
create index if not exists record_reactions_user_id_idx on public.record_reactions (user_id);
create index if not exists record_comments_record_key_created_at_idx on public.record_comments (record_key, created_at);
create index if not exists record_comments_user_id_idx on public.record_comments (user_id);

alter table public.profiles enable row level security;
alter table public.record_reactions enable row level security;
alter table public.record_comments enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "reactions_select_authenticated" on public.record_reactions;
drop policy if exists "reactions_insert_self" on public.record_reactions;
drop policy if exists "reactions_delete_self" on public.record_reactions;

create policy "reactions_select_authenticated"
on public.record_reactions for select
to authenticated
using (true);

create policy "reactions_insert_self"
on public.record_reactions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "reactions_delete_self"
on public.record_reactions for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "comments_select_authenticated" on public.record_comments;
drop policy if exists "comments_insert_self" on public.record_comments;
drop policy if exists "comments_update_self" on public.record_comments;
drop policy if exists "comments_delete_self" on public.record_comments;

create policy "comments_select_authenticated"
on public.record_comments for select
to authenticated
using (true);

create policy "comments_insert_self"
on public.record_comments for insert
to authenticated
with check (auth.uid() = user_id);

create policy "comments_update_self"
on public.record_comments for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "comments_delete_self"
on public.record_comments for delete
to authenticated
using (auth.uid() = user_id);

-- 2026-06 feature expansion: reactions, review flows, hidden records
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists qcoins integer not null default 0;
alter table public.profiles add column if not exists owned_backgrounds jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists active_background text;

alter table public.record_reactions drop constraint if exists record_reactions_type_check;
alter table public.record_reactions add constraint record_reactions_type_check check (type in ('favorite','like','happy','surprised','sad','angry'));

create table if not exists public.comment_likes (
    id uuid primary key default gen_random_uuid(),
    comment_id uuid not null references public.record_comments(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (comment_id, user_id)
);
create index if not exists comment_likes_comment_id_idx on public.comment_likes (comment_id);
create index if not exists comment_likes_user_id_idx on public.comment_likes (user_id);
alter table public.comment_likes enable row level security;
drop policy if exists "comment_likes_select_authenticated" on public.comment_likes;
create policy "comment_likes_select_authenticated" on public.comment_likes for select to authenticated using (true);
drop policy if exists "comment_likes_insert_self" on public.comment_likes;
create policy "comment_likes_insert_self" on public.comment_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "comment_likes_delete_self" on public.comment_likes;
create policy "comment_likes_delete_self" on public.comment_likes for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self" on public.admin_users for select to authenticated using (auth.uid() = user_id);

create table if not exists public.correction_reports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    target_type text not null check (target_type in ('record','person','term')),
    target_id text not null,
    description text not null check (char_length(description) between 1 and 1000),
    status text not null default 'pending' check (status in ('pending','approved','rejected')),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.wall_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    body text not null check (char_length(body) between 1 and 200),
    is_anonymous boolean not null default false,
    public_name text,
    status text not null default 'pending' check (status in ('pending','approved','rejected')),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.person_claim_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    person_id text not null,
    status text not null default 'pending' check (status in ('pending','approved','rejected')),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);
create unique index if not exists person_claim_one_approved_idx on public.person_claim_requests (person_id) where status = 'approved';

create table if not exists public.person_edit_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    person_id text not null,
    display_name text,
    alias text,
    bio text,
    status text not null default 'pending' check (status in ('pending','approved','rejected')),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.class_hidden_records (like public.class_records including defaults including constraints including indexes);
alter table public.class_hidden_records add column if not exists hidden boolean not null default true;
alter table public.class_records add column if not exists hidden boolean not null default false;

alter table public.correction_reports enable row level security;
alter table public.wall_messages enable row level security;
alter table public.person_claim_requests enable row level security;
alter table public.person_edit_requests enable row level security;
alter table public.class_hidden_records enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "correction_insert_self" on public.correction_reports;
create policy "correction_insert_self" on public.correction_reports for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "correction_select_admin" on public.correction_reports;
create policy "correction_select_admin" on public.correction_reports for select to authenticated using (public.is_admin() or auth.uid() = user_id);
drop policy if exists "correction_update_admin" on public.correction_reports;
create policy "correction_update_admin" on public.correction_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "wall_insert_self" on public.wall_messages;
create policy "wall_insert_self" on public.wall_messages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "wall_select_visible" on public.wall_messages;
create policy "wall_select_visible" on public.wall_messages for select to authenticated using (status = 'approved' or public.is_admin() or auth.uid() = user_id);
drop policy if exists "wall_update_admin" on public.wall_messages;
create policy "wall_update_admin" on public.wall_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "claim_insert_self" on public.person_claim_requests;
create policy "claim_insert_self" on public.person_claim_requests for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "claim_select_self_admin" on public.person_claim_requests;
create policy "claim_select_self_admin" on public.person_claim_requests for select to authenticated using (public.is_admin() or auth.uid() = user_id);
drop policy if exists "claim_update_admin" on public.person_claim_requests;
create policy "claim_update_admin" on public.person_claim_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "edit_insert_self" on public.person_edit_requests;
create policy "edit_insert_self" on public.person_edit_requests for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "edit_select_self_admin" on public.person_edit_requests;
create policy "edit_select_self_admin" on public.person_edit_requests for select to authenticated using (public.is_admin() or auth.uid() = user_id);
drop policy if exists "edit_update_admin" on public.person_edit_requests;
create policy "edit_update_admin" on public.person_edit_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "class_hidden_records_select_authenticated" on public.class_hidden_records;
create policy "class_hidden_records_select_authenticated" on public.class_hidden_records for select to authenticated using (true);
