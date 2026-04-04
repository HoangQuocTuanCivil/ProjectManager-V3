-- team_leader: tasks, task_comments, teams RLS + fn_has_permission

-- Tasks SELECT: assigned/assigner hoặc trong team mình
DROP POLICY IF EXISTS "t_tl_r" ON tasks;
CREATE POLICY "t_tl_r" ON tasks FOR SELECT TO authenticated USING (
  auth.user_role() = 'team_leader'
  AND org_id = auth.user_org_id()
  AND (
    assignee_id = auth.uid()
    OR assigner_id = auth.uid()
    OR team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid() AND is_active = true)
  )
);

-- Tasks INSERT
DROP POLICY IF EXISTS "t_tl_i" ON tasks;
CREATE POLICY "t_tl_i" ON tasks FOR INSERT TO authenticated WITH CHECK (
  auth.user_role() = 'team_leader'
  AND org_id = auth.user_org_id()
);

-- Tasks UPDATE
DROP POLICY IF EXISTS "t_tl_u" ON tasks;
CREATE POLICY "t_tl_u" ON tasks FOR UPDATE TO authenticated USING (
  auth.user_role() = 'team_leader'
  AND org_id = auth.user_org_id()
  AND (
    assignee_id = auth.uid()
    OR assigner_id = auth.uid()
    OR team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid() AND is_active = true)
  )
);

-- Task Comments SELECT
DROP POLICY IF EXISTS "tc_tl_r" ON task_comments;
CREATE POLICY "tc_tl_r" ON task_comments FOR SELECT TO authenticated USING (
  auth.user_role() = 'team_leader'
  AND task_id IN (
    SELECT id FROM tasks
    WHERE org_id = auth.user_org_id()
      AND team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid() AND is_active = true)
  )
);

-- Task Comments INSERT
DROP POLICY IF EXISTS "tc_tl_i" ON task_comments;
CREATE POLICY "tc_tl_i" ON task_comments FOR INSERT TO authenticated WITH CHECK (
  auth.user_role() = 'team_leader'
);

-- Teams: team_leader can update their own team
DROP POLICY IF EXISTS "teams_tl_u" ON teams;
CREATE POLICY "teams_tl_u" ON teams FOR UPDATE TO authenticated USING (
  leader_id = auth.uid()
  AND is_active = true
  AND auth.user_role() = 'team_leader'
);

-- fn_has_permission: team_leader branch
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
    WHEN 'team_leader' THEN p_perm IN (
      'task.view_team','task.create','task.edit_others','task.update_progress',
      'project.view_all',
      'kpi.view_self',
      'goals.create'
    )
    WHEN 'staff' THEN p_perm IN (
      'task.view_self','task.update_progress','kpi.view_self'
    )
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
