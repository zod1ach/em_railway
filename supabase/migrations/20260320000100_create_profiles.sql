-- User profiles table
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  title text,
  full_name text not null,
  affiliation text,
  avatar_style text not null default 'adventurer',
  avatar_seed text not null default 'default',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Users can read any profile (needed for team member display)
create policy "Anyone can view profiles" on public.profiles
  for select using (true);

-- Users can only insert/update their own profile
create policy "Users can insert own profile" on public.profiles
  for insert with check (id = auth.uid());

create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());
