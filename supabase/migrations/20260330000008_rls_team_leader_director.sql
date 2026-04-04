-- Migration: RLS policies for team_leader and director roles
-- These roles were added after initial schema but had NO RLS policies,
-- causing team_leader/director users to see zero rows on all tables.

-- Helpers: public-schema wrappers (auth.* equivalents)
-- Many migrations (002, 004, 006) reference auth.user_org_id() etc.
-- but those functions were only defined in auth schema.  Create them here.
CREATE OR REPLACE FUNCTION auth.user_org_id() RETURNS UUID AS $$
  SELECT org_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_role() RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_dept_id() RETURNS UUID AS $$
  SELECT dept_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_team_id() RETURNS UUID AS $$
  SELECT team_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- DIRECTOR: Same access as leader (level 4)

-- Update existing leader policies to include director
-- Tasks
DROP POLICY IF EXISTS "t_leader" ON tasks;
CREATE POLICY "t_leader" ON tasks FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader', 'director'));

-- Projects
DROP POLICY IF EXISTS "proj_m" ON projects;
CREATE POLICY "proj_m" ON projects FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader', 'director'));

-- Users manage
DROP POLICY IF EXISTS "users_manage" ON users;
CREATE POLICY "users_manage" ON users FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader', 'director'));

-- Departments manage
DROP POLICY IF EXISTS "dept_m" ON departments;
CREATE POLICY "dept_m" ON departments FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader', 'director'));

-- Workflow templates manage
DROP POLICY IF EXISTS "wf_m" ON workflow_templates;
CREATE POLICY "wf_m" ON workflow_templates FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader', 'director'));

-- Audit logs
DROP POLICY IF EXISTS "audit_r" ON audit_logs;
CREATE POLICY "audit_r" ON audit_logs FOR SELECT
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader', 'director'));

-- Org settings
DROP POLICY IF EXISTS "set_m" ON org_settings;
CREATE POLICY "set_m" ON org_settings FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader', 'director'));

-- TEAM_LEADER: See tasks in their team + tasks assigned to them

-- Tasks: team_leader can see tasks in their team OR assigned to them
DROP POLICY IF EXISTS "t_tl_r" ON tasks;
CREATE POLICY "t_tl_r" ON tasks FOR SELECT
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() = 'team_leader'
    AND (
      team_id = public.user_team_id()
      OR assignee_id = auth.uid()
      OR assigner_id = auth.uid()
    )
  );

-- Tasks: team_leader can insert tasks in their team
DROP POLICY IF EXISTS "t_tl_i" ON tasks;
CREATE POLICY "t_tl_i" ON tasks FOR INSERT
  WITH CHECK (
    org_id = auth.user_org_id()
    AND auth.user_role() = 'team_leader'
  );

-- Tasks: team_leader can update tasks in their team or assigned to them
DROP POLICY IF EXISTS "t_tl_u" ON tasks;
CREATE POLICY "t_tl_u" ON tasks FOR UPDATE
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() = 'team_leader'
    AND (
      team_id = public.user_team_id()
      OR assignee_id = auth.uid()
    )
  );

-- TEAM_LEADER: Other tables (read access like staff+)

-- Projects: team_leader can read all org projects (same as existing proj_r)
-- (proj_r already allows all org users to read, so no change needed)

-- Task comments: already handled by tc_select/tc_insert policies
-- Task attachments: already handled

-- Notifications: team_leader needs to see their own notifications
-- (notification policies typically use user_id = auth.uid(), already OK)

-- Teams: team_leader can read teams in their org
-- (teams likely have org-wide read policy, already OK)

-- UPDATE fn_has_permission to include team_leader role
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
    WHEN 'team_leader' THEN p_perm IN (
      'task.view_dept','task.create','task.update_progress',
      'project.view_all',
      'kpi.view_dept','kpi.view_self',
      'goals.view_all'
    )
    WHEN 'staff' THEN p_perm IN ('task.view_self','task.update_progress','kpi.view_self')
    ELSE FALSE END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
