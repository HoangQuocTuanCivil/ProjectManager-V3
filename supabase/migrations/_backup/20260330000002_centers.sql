-- Tạo bảng centers + RLS + policies (depends on 20260330000001)

CREATE TABLE IF NOT EXISTS centers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT,
  description   TEXT,
  director_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, code)
);

-- THÊM center_id VÀO departments VÀ users
ALTER TABLE departments ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- INDEXES
CREATE INDEX idx_centers_org ON centers(org_id);
CREATE INDEX idx_centers_director ON centers(director_id);
CREATE INDEX idx_depts_center_id ON departments(center_id);
CREATE INDEX idx_users_center_id ON users(center_id) WHERE center_id IS NOT NULL;

-- TRIGGER cập nhật timestamp
CREATE TRIGGER trg_center_ts BEFORE UPDATE ON centers FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- RLS CHO CENTERS
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "center_read" ON centers;
CREATE POLICY "center_read" ON centers FOR SELECT
  USING (org_id = auth.user_org_id());

DROP POLICY IF EXISTS "center_manage" ON centers;
CREATE POLICY "center_manage" ON centers FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- RLS HELPER: user_center_id()
CREATE OR REPLACE FUNCTION public.user_center_id() RETURNS UUID AS $$
  SELECT center_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- CẬP NHẬT fn_has_permission CHO ROLE director
CREATE OR REPLACE FUNCTION fn_has_permission(p_user UUID, p_perm TEXT) RETURNS BOOLEAN AS $$
DECLARE v_role user_role; v_cr UUID;
BEGIN
  SELECT role, custom_role_id INTO v_role, v_cr FROM users WHERE id = p_user;
  IF v_role = 'admin' THEN RETURN TRUE; END IF;
  IF v_cr IS NOT NULL THEN RETURN EXISTS(SELECT 1 FROM role_permissions WHERE role_id = v_cr AND permission_id = p_perm); END IF;
  RETURN CASE v_role
    WHEN 'leader' THEN p_perm NOT IN ('settings.security')
    WHEN 'director' THEN p_perm IN (
      'task.view_all','task.view_dept','task.create','task.edit_others','task.update_progress',
      'task.score_kpi','task.approve','task.delete',
      'project.view_all','project.edit','project.manage_members','project.create',
      'kpi.view_company','kpi.view_dept','kpi.view_self','kpi.config','kpi.create_period',
      'settings.users','settings.depts','settings.templates','settings.workflows',
      'goals.create','goals.view_all','goals.manage'
    )
    WHEN 'head' THEN p_perm IN (
      'task.view_dept','task.create','task.edit_others','task.update_progress',
      'task.score_kpi','task.approve',
      'project.view_all','project.edit','project.manage_members',
      'kpi.view_dept','kpi.view_self',
      'settings.templates',
      'goals.create','goals.view_all'
    )
    WHEN 'staff' THEN p_perm IN ('task.view_self','task.update_progress','kpi.view_self')
    ELSE FALSE END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- CẬP NHẬT RLS tasks cho director
DROP POLICY IF EXISTS "t_director" ON tasks;
CREATE POLICY "t_director" ON tasks FOR ALL USING (
  org_id = auth.user_org_id()
  AND auth.user_role() = 'director'
  AND dept_id IN (
    SELECT d.id FROM departments d WHERE d.center_id = public.user_center_id()
  )
);

-- CẬP NHẬT RLS departments cho director
DROP POLICY IF EXISTS "dept_director" ON departments;
CREATE POLICY "dept_director" ON departments FOR ALL USING (
  org_id = auth.user_org_id()
  AND auth.user_role() = 'director'
  AND center_id = public.user_center_id()
);

-- RLS teams cho director
DROP POLICY IF EXISTS "teams_director" ON teams;
CREATE POLICY "teams_director" ON teams FOR ALL USING (
  org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) = 'director'
  AND dept_id IN (
    SELECT d.id FROM departments d WHERE d.center_id = (SELECT center_id FROM users WHERE id = auth.uid())
  )
);
