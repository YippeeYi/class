-- Safe migration for existing Class Record databases.
alter table public.class_people
add column if not exists subject text;

alter table public.class_people
add column if not exists main boolean not null default false;
