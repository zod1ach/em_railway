-- ============================================================
-- Migration: Team-only project limits
-- Personal projects now live in IndexedDB (offline only).
-- Supabase is exclusively for team/collaborative projects.
-- New limit: 1 team project CREATED per user, join unlimited.
-- ============================================================

-- 1. New function: count only OWNED team projects (not membership)
CREATE OR REPLACE FUNCTION public.count_team_projects_owned(uid uuid)
RETURNS integer AS $$
  SELECT count(*)::integer FROM public.projects
  WHERE owner_id = uid AND type = 'team';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Replace INSERT policy: team only, max 1 created
DROP POLICY IF EXISTS "Users can insert own projects with limits" ON public.projects;

CREATE POLICY "Users can insert own team projects" ON public.projects
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    AND type = 'team'
    AND public.count_team_projects_owned(auth.uid()) < 1
  );

-- 3. Drop unused personal project counter
DROP FUNCTION IF EXISTS public.count_personal_projects(uuid);
