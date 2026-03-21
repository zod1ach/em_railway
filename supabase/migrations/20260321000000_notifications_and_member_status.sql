-- ============================================================
-- Migration: Notifications system + member invite status
-- ============================================================

-- 1. Add status to project_members (pending until accepted)
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted'
  CHECK (status IN ('pending', 'accepted', 'declined'));

-- Existing members (owners) stay 'accepted'. New invites start as 'pending'.

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('invite', 'invite_accepted', 'invite_declined', 'role_changed', 'removed')),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  project_name text NOT NULL,
  from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  from_user_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- Allow inserting notifications (server-side or by project owners)
CREATE POLICY "Users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- 3. Update project_members policies for status-based visibility
-- Members should only see accepted members (not pending/declined ones from other users)
-- The existing SELECT policy from migration 000600 handles this via get_user_project_ids

-- 4. Allow project members to update their own membership (accept/decline)
CREATE POLICY "Members can update own membership" ON public.project_members
  FOR UPDATE USING (user_id = auth.uid());

-- 5. Allow project owners to delete members
CREATE POLICY "Owners can delete project members" ON public.project_members
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
  );

-- 6. Allow project owners to update member roles
CREATE POLICY "Owners can update project members" ON public.project_members
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
  );
