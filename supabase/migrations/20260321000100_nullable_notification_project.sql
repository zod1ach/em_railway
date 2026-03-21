-- Allow notifications to exist without a project reference
-- (needed for "project deleted" notifications where the project no longer exists)
ALTER TABLE public.notifications
  ALTER COLUMN project_id DROP NOT NULL;

-- Update FK to SET NULL instead of CASCADE so notifications survive project deletion
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_project_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- Also allow DELETE on projects by owner
CREATE POLICY "Owners can delete own projects" ON public.projects
  FOR DELETE USING (owner_id = auth.uid());
