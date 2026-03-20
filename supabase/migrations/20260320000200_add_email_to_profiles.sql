-- Add email column to profiles for searchability
alter table public.profiles add column if not exists email text;

-- Create index for email search
create index if not exists idx_profiles_email on public.profiles (email);
