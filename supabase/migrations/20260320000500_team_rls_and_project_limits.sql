-- ============================================================
-- Migration: Team RLS fixes, project limit functions, FK for joins
-- ============================================================

-- 1. Add FK from projects.owner_id → profiles.id so Supabase join syntax works
ALTER TABLE public.projects
  ADD CONSTRAINT fk_projects_owner_profile
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id);

-- 2. Let team members view projects they belong to
CREATE POLICY "Members can view their projects" ON public.projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    )
  );

-- 3. Let members see fellow members of projects they belong to
CREATE POLICY "Members can view fellow members" ON public.project_members
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE user_id = auth.uid()
    )
  );

-- 4. Server-side limit enforcement functions
CREATE OR REPLACE FUNCTION public.count_personal_projects(uid uuid)
RETURNS integer AS $$
  SELECT count(*)::integer FROM public.projects
  WHERE owner_id = uid AND type = 'personal';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.count_team_projects(uid uuid)
RETURNS integer AS $$
  SELECT count(DISTINCT p.id)::integer
  FROM public.projects p
  LEFT JOIN public.project_members pm ON pm.project_id = p.id
  WHERE p.type = 'team'
    AND (p.owner_id = uid OR pm.user_id = uid);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. Replace INSERT policy with limit-enforced version
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;

CREATE POLICY "Users can insert own projects with limits" ON public.projects
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    AND (
      (type = 'personal' AND public.count_personal_projects(auth.uid()) < 2)
      OR
      (type = 'team' AND public.count_team_projects(auth.uid()) < 2)
    )
  );
