-- ============================================================
-- Fix: Replace recursive RLS policies with SECURITY DEFINER functions
-- The previous policies caused infinite recursion because
-- project_members SELECT policy queried project_members itself.
-- ============================================================

-- Helper: returns project_ids a user is a member of (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_project_ids(uid uuid)
RETURNS SETOF uuid AS $$
  SELECT project_id FROM public.project_members WHERE user_id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Members can view fellow members" ON public.project_members;

-- Re-create using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Members can view their projects" ON public.projects
  FOR SELECT USING (
    id IN (SELECT public.get_user_project_ids(auth.uid()))
  );

CREATE POLICY "Members can view fellow members" ON public.project_members
  FOR SELECT USING (
    project_id IN (SELECT public.get_user_project_ids(auth.uid()))
  );
