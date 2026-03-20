-- Projects table
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  type text not null check (type in ('personal', 'team')),
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- Project members table
create table if not exists public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'Viewer' check (role in ('Owner', 'Editor', 'Viewer')),
  created_at timestamptz default now(),
  unique(project_id, email)
);

-- Enable RLS
alter table public.projects enable row level security;
alter table public.project_members enable row level security;

-- Policies
create policy "Users can view own projects" on public.projects
  for select using (owner_id = auth.uid());

create policy "Users can insert own projects" on public.projects
  for insert with check (owner_id = auth.uid());

create policy "Users can view project members" on public.project_members
  for select using (
    project_id in (select id from public.projects where owner_id = auth.uid())
  );

create policy "Users can manage project members" on public.project_members
  for insert with check (
    project_id in (select id from public.projects where owner_id = auth.uid())
  );
