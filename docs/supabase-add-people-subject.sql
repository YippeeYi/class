-- Safe migration for existing Class Record databases.
alter table public.class_people
add column if not exists subject text;
