-- Create project_files table
CREATE TABLE IF NOT EXISTS project_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('cable', 'wmm', 'bathymetry')),
  sub_type TEXT CHECK (
    (category = 'cable' AND sub_type IN ('hvac', 'dc_bipole'))
    OR (category != 'cable' AND sub_type IS NULL)
  ),
  name TEXT NOT NULL,
  file_data JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- SELECT: owners + all accepted members can view files
CREATE POLICY pf_select ON project_files FOR SELECT USING (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

-- INSERT: owners + Editor members can create files
CREATE POLICY pf_insert ON project_files FOR INSERT WITH CHECK (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND status = 'accepted' AND role IN ('Owner', 'Editor')
  )
);

-- UPDATE: owners + Editor members can update files
CREATE POLICY pf_update ON project_files FOR UPDATE USING (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND status = 'accepted' AND role IN ('Owner', 'Editor')
  )
);

-- DELETE: owners + Editor members can delete files
CREATE POLICY pf_delete ON project_files FOR DELETE USING (
  project_id IN (
    SELECT id FROM projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND status = 'accepted' AND role IN ('Owner', 'Editor')
  )
);
