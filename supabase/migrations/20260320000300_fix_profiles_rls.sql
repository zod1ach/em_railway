-- Drop restrictive policy if exists and ensure anyone authenticated can search profiles
drop policy if exists "Anyone can view profiles" on public.profiles;
create policy "Authenticated users can view all profiles" on public.profiles
  for select using (auth.role() = 'authenticated');

-- Also allow users to update their own profile (for backfill)
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());
