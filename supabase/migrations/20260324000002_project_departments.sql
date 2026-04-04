-- project_departments: Many-to-many relationship between projects and departments

CREATE TABLE IF NOT EXISTS project_departments (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dept_id    UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, dept_id)
);

ALTER TABLE project_departments ENABLE ROW LEVEL SECURITY;

-- Read: all org users can see project-department assignments
DROP POLICY IF EXISTS "pd_r" ON project_departments;
CREATE POLICY "pd_r" ON project_departments FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id = auth.user_org_id()));

-- Manage: only admin/leader can assign departments to projects
DROP POLICY IF EXISTS "pd_m" ON project_departments;
CREATE POLICY "pd_m" ON project_departments FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader'));
