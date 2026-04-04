-- Migration 014: RLS Helpers & Policies

-- RLS Helper Functions
CREATE OR REPLACE FUNCTION auth.user_org_id() RETURNS UUID AS $$ SELECT org_id FROM users WHERE id=auth.uid(); $$ LANGUAGE SQL SECURITY DEFINER STABLE;
CREATE OR REPLACE FUNCTION auth.user_dept_id() RETURNS UUID AS $$ SELECT dept_id FROM users WHERE id=auth.uid(); $$ LANGUAGE SQL SECURITY DEFINER STABLE;
CREATE OR REPLACE FUNCTION auth.user_role() RETURNS user_role AS $$ SELECT role FROM users WHERE id=auth.uid(); $$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Enable RLS on ALL tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'organizations','departments','users','projects','project_members',
    'goals','goal_targets','milestones','tasks','task_comments',
    'task_attachments','task_status_logs','task_scores','task_dependencies',
    'task_checklists','checklist_items','time_entries',
    'kpi_configs','allocation_configs','allocation_periods','allocation_results',
    'kpi_records','project_kpi_summary','global_kpi_summary',
    'notifications','user_sessions','audit_logs','user_invitations',
    'permissions','custom_roles','role_permissions',
    'workflow_templates','workflow_steps','workflow_transitions',
    'task_workflow_state','workflow_history',
    'task_templates','project_templates','intake_forms','form_submissions',
    'status_updates','dashboards','dashboard_widgets',
    'automation_rules','automation_logs','org_settings'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- RLS Policies

-- Organizations
CREATE POLICY "org_r" ON organizations FOR SELECT USING (id=auth.user_org_id());

-- Users
CREATE POLICY "users_r" ON users FOR SELECT USING (org_id=auth.user_org_id());
CREATE POLICY "users_u_self" ON users FOR UPDATE USING (id=auth.uid());
CREATE POLICY "users_manage" ON users FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Departments
CREATE POLICY "dept_r" ON departments FOR SELECT USING (org_id=auth.user_org_id());
CREATE POLICY "dept_m" ON departments FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Tasks (role-based)
CREATE POLICY "t_leader" ON tasks FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));
CREATE POLICY "t_head_r" ON tasks FOR SELECT USING (org_id=auth.user_org_id() AND auth.user_role()='head' AND dept_id=auth.user_dept_id());
CREATE POLICY "t_head_i" ON tasks FOR INSERT WITH CHECK (org_id=auth.user_org_id() AND auth.user_role()='head' AND dept_id=auth.user_dept_id());
CREATE POLICY "t_head_u" ON tasks FOR UPDATE USING (org_id=auth.user_org_id() AND auth.user_role()='head' AND dept_id=auth.user_dept_id());
CREATE POLICY "t_staff_r" ON tasks FOR SELECT USING (org_id=auth.user_org_id() AND auth.user_role()='staff' AND assignee_id=auth.uid());
CREATE POLICY "t_staff_u" ON tasks FOR UPDATE USING (org_id=auth.user_org_id() AND auth.user_role()='staff' AND assignee_id=auth.uid());

-- Projects
CREATE POLICY "proj_r" ON projects FOR SELECT USING (org_id=auth.user_org_id());
CREATE POLICY "proj_m" ON projects FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Notifications
CREATE POLICY "notif_r" ON notifications FOR SELECT USING (user_id=auth.uid());
CREATE POLICY "notif_u" ON notifications FOR UPDATE USING (user_id=auth.uid());

-- Audit
CREATE POLICY "audit_r" ON audit_logs FOR SELECT USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Permissions (public read)
CREATE POLICY "perm_r" ON permissions FOR SELECT USING (TRUE);

-- Settings
CREATE POLICY "set_r" ON org_settings FOR SELECT USING (org_id=auth.user_org_id());
CREATE POLICY "set_m" ON org_settings FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Workflows
CREATE POLICY "wf_r" ON workflow_templates FOR SELECT USING (org_id=auth.user_org_id());
CREATE POLICY "wf_m" ON workflow_templates FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Dashboards
CREATE POLICY "dash_own" ON dashboards FOR ALL USING (owner_id=auth.uid());
CREATE POLICY "dash_shared" ON dashboards FOR SELECT USING (org_id=auth.user_org_id() AND is_shared=TRUE);
