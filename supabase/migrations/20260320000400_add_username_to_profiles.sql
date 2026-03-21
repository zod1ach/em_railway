-- Add username column to profiles
alter table public.profiles
  add column if not exists username text;

-- Unique constraint on username (allow nulls)
create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;
