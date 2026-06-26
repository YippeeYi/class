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
    type text not null check (type in ('like', 'happy', 'surprised', 'sad', 'angry', 'favorite')),
    created_at timestamptz not null default now(),
    unique (record_key, user_id, type)
);

alter table public.record_reactions drop constraint if exists record_reactions_type_check;
alter table public.record_reactions
    add constraint record_reactions_type_check check (type in ('like', 'happy', 'surprised', 'sad', 'angry', 'favorite'));

create table if not exists public.record_comments (
    id uuid primary key default gen_random_uuid(),
    record_key text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    body text not null check (char_length(body) between 1 and 500),
    author_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.record_comment_likes (
    id uuid primary key default gen_random_uuid(),
    comment_id uuid not null references public.record_comments(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (comment_id, user_id)
);

create index if not exists record_reactions_record_key_idx on public.record_reactions (record_key);
create index if not exists record_reactions_user_id_idx on public.record_reactions (user_id);
create index if not exists record_comments_record_key_created_at_idx on public.record_comments (record_key, created_at);
create index if not exists record_comments_user_id_idx on public.record_comments (user_id);
create index if not exists record_comment_likes_comment_id_idx on public.record_comment_likes (comment_id);
create index if not exists record_comment_likes_user_id_idx on public.record_comment_likes (user_id);

alter table public.profiles enable row level security;
alter table public.record_reactions enable row level security;
alter table public.record_comments enable row level security;
alter table public.record_comment_likes enable row level security;

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

drop policy if exists "comment_likes_select_authenticated" on public.record_comment_likes;
drop policy if exists "comment_likes_insert_self" on public.record_comment_likes;
drop policy if exists "comment_likes_delete_self" on public.record_comment_likes;

create policy "comment_likes_select_authenticated"
on public.record_comment_likes for select
to authenticated
using (true);

create policy "comment_likes_insert_self"
on public.record_comment_likes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "comment_likes_delete_self"
on public.record_comment_likes for delete
to authenticated
using (auth.uid() = user_id);
