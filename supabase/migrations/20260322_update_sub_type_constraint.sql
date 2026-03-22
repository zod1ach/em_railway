ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_sub_type_check;
ALTER TABLE project_files ADD CONSTRAINT project_files_sub_type_check CHECK (
  (category = 'cable' AND sub_type IN ('hvac', 'dc_bipole'))
  OR (category = 'wmm' AND (sub_type IN ('grid', 'line') OR sub_type IS NULL))
  OR (category = 'bathymetry' AND sub_type IS NULL)
);
