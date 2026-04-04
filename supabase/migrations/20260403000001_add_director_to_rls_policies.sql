-- Thêm 'director' vào RLS manage policies + xóa dead team_leader policies

DROP POLICY IF EXISTS "t_tl_r" ON tasks;
DROP POLICY IF EXISTS "t_tl_i" ON tasks;
DROP POLICY IF EXISTS "t_tl_u" ON tasks;

-- Project Members
DROP POLICY IF EXISTS "pm_m" ON project_members;
CREATE POLICY "pm_m" ON project_members FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director', 'head')
  );

-- Goals
DROP POLICY IF EXISTS "goal_m" ON goals;
CREATE POLICY "goal_m" ON goals FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director', 'head')
  );

-- Goal Targets
DROP POLICY IF EXISTS "gt_m" ON goal_targets;
CREATE POLICY "gt_m" ON goal_targets FOR ALL
  USING (
    goal_id IN (SELECT id FROM goals WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director', 'head')
  );

-- Goal Projects
DROP POLICY IF EXISTS "gp_m" ON goal_projects;
CREATE POLICY "gp_m" ON goal_projects FOR ALL
  USING (
    goal_id IN (SELECT id FROM goals WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Milestones
DROP POLICY IF EXISTS "ms_m" ON milestones;
CREATE POLICY "ms_m" ON milestones FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director', 'head')
  );

-- Task Attachments
DROP POLICY IF EXISTS "ta_m" ON task_attachments;
CREATE POLICY "ta_m" ON task_attachments FOR ALL
  USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director', 'head')
  );

DROP POLICY IF EXISTS "ta_d" ON task_attachments;
CREATE POLICY "ta_d" ON task_attachments FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Task Scores
DROP POLICY IF EXISTS "ts_m" ON task_scores;
DROP POLICY IF EXISTS "ts_i" ON task_scores;
DROP POLICY IF EXISTS "ts_m" ON task_scores;
CREATE POLICY "ts_m" ON task_scores FOR ALL
  USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director', 'head')
  );

-- Task Dependencies
DROP POLICY IF EXISTS "td_m" ON task_dependencies;
CREATE POLICY "td_m" ON task_dependencies FOR ALL
  USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director', 'head')
  );

-- Task Comments (DELETE)
DROP POLICY IF EXISTS "tc_delete" ON task_comments;
DROP POLICY IF EXISTS "tc_d" ON task_comments;
DROP POLICY IF EXISTS "tc_delete" ON task_comments;
CREATE POLICY "tc_delete" ON task_comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR auth.user_role() IN ('admin', 'leader', 'director')
  );

-- KPI Configs
DROP POLICY IF EXISTS "kc_m"   ON kpi_configs;
DROP POLICY IF EXISTS "kpic_m" ON kpi_configs;
DROP POLICY IF EXISTS "kc_m" ON kpi_configs;
CREATE POLICY "kc_m" ON kpi_configs FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Allocation Configs
DROP POLICY IF EXISTS "ac_m" ON allocation_configs;
CREATE POLICY "ac_m" ON allocation_configs FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Allocation Periods
DROP POLICY IF EXISTS "ap_m" ON allocation_periods;
CREATE POLICY "ap_m" ON allocation_periods FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Allocation Results
DROP POLICY IF EXISTS "ar_m" ON allocation_results;
CREATE POLICY "ar_m" ON allocation_results FOR ALL
  USING (
    period_id IN (SELECT id FROM allocation_periods WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- KPI Records
DROP POLICY IF EXISTS "kr_m"      ON kpi_records;
DROP POLICY IF EXISTS "kr_manage" ON kpi_records;
DROP POLICY IF EXISTS "kr_m" ON kpi_records;
CREATE POLICY "kr_m" ON kpi_records FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director', 'head')
  );

-- Project KPI Summary
DROP POLICY IF EXISTS "pks_m" ON project_kpi_summary;
CREATE POLICY "pks_m" ON project_kpi_summary FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Global KPI Summary
DROP POLICY IF EXISTS "gks_m" ON global_kpi_summary;
CREATE POLICY "gks_m" ON global_kpi_summary FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- User Invitations
DROP POLICY IF EXISTS "inv_m" ON user_invitations;
CREATE POLICY "inv_m" ON user_invitations FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Custom Roles
DROP POLICY IF EXISTS "cr_m" ON custom_roles;
CREATE POLICY "cr_m" ON custom_roles FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Role Permissions
DROP POLICY IF EXISTS "rp_m" ON role_permissions;
CREATE POLICY "rp_m" ON role_permissions FOR ALL
  USING (
    role_id IN (SELECT id FROM custom_roles WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Workflow Steps
DROP POLICY IF EXISTS "ws_m" ON workflow_steps;
CREATE POLICY "ws_m" ON workflow_steps FOR ALL
  USING (
    template_id IN (SELECT id FROM workflow_templates WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Workflow Transitions
DROP POLICY IF EXISTS "wt_m"  ON workflow_transitions;
DROP POLICY IF EXISTS "wtr_m" ON workflow_transitions;
DROP POLICY IF EXISTS "wt_m" ON workflow_transitions;
CREATE POLICY "wt_m" ON workflow_transitions FOR ALL
  USING (
    template_id IN (SELECT id FROM workflow_templates WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Task Templates
DROP POLICY IF EXISTS "tt_m" ON task_templates;
CREATE POLICY "tt_m" ON task_templates FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Project Templates
DROP POLICY IF EXISTS "pt_m" ON project_templates;
CREATE POLICY "pt_m" ON project_templates FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Intake Forms
DROP POLICY IF EXISTS "if_m" ON intake_forms;
CREATE POLICY "if_m" ON intake_forms FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Automation Rules
DROP POLICY IF EXISTS "aur_m" ON automation_rules;
DROP POLICY IF EXISTS "atr_m" ON automation_rules;
DROP POLICY IF EXISTS "aur_m" ON automation_rules;
CREATE POLICY "aur_m" ON automation_rules FOR ALL
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Automation Logs
DROP POLICY IF EXISTS "atl_r" ON automation_logs;
CREATE POLICY "atl_r" ON automation_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM automation_rules ar WHERE ar.id = rule_id AND ar.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader', 'director')
  );

-- Status Updates (all roles in org)
DROP POLICY IF EXISTS "su_m" ON status_updates;
CREATE POLICY "su_m" ON status_updates FOR ALL
  USING (
    (project_id IS NOT NULL AND project_id IN (SELECT id FROM projects WHERE org_id = auth.user_org_id()))
    OR
    (goal_id IS NOT NULL AND goal_id IN (SELECT id FROM goals WHERE org_id = auth.user_org_id()))
  );

-- fn_has_permission (remove dead team_leader branch)
CREATE OR REPLACE FUNCTION fn_has_permission(p_user UUID, p_perm TEXT) RETURNS BOOLEAN AS $$
DECLARE v_role user_role; v_cr UUID;
BEGIN
  SELECT role, custom_role_id INTO v_role, v_cr FROM users WHERE id = p_user;
  IF v_role = 'admin' THEN RETURN TRUE; END IF;
  IF v_cr IS NOT NULL THEN
    RETURN EXISTS(SELECT 1 FROM role_permissions WHERE role_id = v_cr AND permission_id = p_perm);
  END IF;
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
    WHEN 'staff' THEN p_perm IN (
      'task.view_self','task.update_progress','kpi.view_self'
    )
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
