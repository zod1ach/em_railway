-- Project files: model file metadata for team projects

CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('cable', 'wmm', 'bathymetry')),
  sub_type TEXT CHECK (
    (category = 'cable' AND sub_type IN ('hvac', 'dc_bipole'))
    OR (category != 'cable' AND sub_type IS NULL)
  ),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_files_project_id ON project_files(project_id);

-- 4-file limit trigger
CREATE OR REPLACE FUNCTION enforce_team_file_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM project_files WHERE project_id = NEW.project_id) >= 4 THEN
    RAISE EXCEPTION 'Team project file limit (4) exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_file_limit
  BEFORE INSERT ON project_files
  FOR EACH ROW EXECUTE FUNCTION enforce_team_file_limit();

-- RLS policies
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project files"
  ON project_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_files.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.status = 'accepted'
    )
  );

CREATE POLICY "Owners and editors can create files"
  ON project_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_files.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('Owner', 'Editor')
        AND project_members.status = 'accepted'
    )
  );

CREATE POLICY "Owners and editors can delete files"
  ON project_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_files.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('Owner', 'Editor')
        AND project_members.status = 'accepted'
    )
  );
