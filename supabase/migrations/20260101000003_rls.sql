-- ============================================================================
-- A2Z WORKHUB — ROW LEVEL SECURITY POLICIES (consolidated)
-- Tất cả RLS policies cho toàn bộ hệ thống
-- ============================================================================

-- ─── BẬT RLS CHO TẤT CẢ BẢNG ───────────────────────────────────────────────

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    -- Core
    'organizations','departments','users','centers','teams',
    -- Dự án
    'projects','project_members','project_departments',
    -- Mục tiêu
    'goals','goal_targets','goal_projects','milestones',
    -- Task
    'tasks','task_comments','task_attachments','task_status_logs','task_scores',
    'task_dependencies','task_checklists','checklist_items','time_entries',
    -- KPI & Phân bổ
    'kpi_configs','allocation_configs','allocation_periods','allocation_results',
    'dept_budget_allocations','kpi_records','project_kpi_summary','global_kpi_summary',
    'allocation_cycle_config',
    -- Lương & hệ số
    'salary_records','salary_deductions','project_dept_factors',
    -- Hệ thống
    'notifications','user_sessions','audit_logs','user_invitations',
    'permissions','custom_roles','role_permissions',
    -- Workflow
    'workflow_templates','workflow_steps','workflow_transitions',
    'task_workflow_state','workflow_history',
    -- Template & form
    'task_templates','project_templates','intake_forms','form_submissions',
    -- Dashboard & settings
    'status_updates','dashboards','dashboard_widgets',
    'automation_rules','automation_logs','org_settings',
    'task_proposals',
    -- Hợp đồng
    'contracts','contract_addendums','billing_milestones',
    -- Doanh thu & chi phí
    'product_services','product_service_categories',
    'revenue_entries','internal_revenue','cost_entries',
    'revenue_adjustments','dept_revenue_allocations',
    -- Module & nghiệm thu
    'module_access','acceptance_rounds','period_project_factors'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- ─── ORGANIZATIONS ───────────────────────────────────────────────────────────
-- Đọc: chỉ org mình
CREATE POLICY "org_r" ON organizations FOR SELECT USING (id = public.user_org_id());

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Đọc: cùng org | Sửa profile: chính mình | Quản lý: admin, leader | Director: scoped theo center
CREATE POLICY "users_r" ON users FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "users_u_self" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users_manage" ON users FOR ALL USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader'));
CREATE POLICY "users_director" ON users FOR ALL
  USING (
    public.user_role() = 'director'
    AND org_id = public.user_org_id()
    AND (
      dept_id IN (SELECT id FROM departments WHERE center_id = public.user_center_id())
      OR center_id = public.user_center_id()
      OR id = auth.uid()
    )
  );

-- ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
CREATE POLICY "dept_r" ON departments FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "dept_m" ON departments FOR ALL USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader'));
CREATE POLICY "dept_director" ON departments FOR ALL
  USING (public.user_role() = 'director' AND org_id = public.user_org_id() AND center_id = public.user_center_id());

-- ─── CENTERS ─────────────────────────────────────────────────────────────────
CREATE POLICY "center_read" ON centers FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "center_manage" ON centers FOR ALL USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader'));

-- ─── TEAMS ───────────────────────────────────────────────────────────────────
-- Đọc: cùng org | CRUD: admin/leader/head | Director: scoped | Team leader: sửa team mình
CREATE POLICY "teams_read" ON teams FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "teams_insert" ON teams FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.user_role() IN ('admin','leader','head'));
CREATE POLICY "teams_update" ON teams FOR UPDATE
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin','leader','head'));
CREATE POLICY "teams_delete" ON teams FOR DELETE
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin','leader','head'));
CREATE POLICY "teams_director" ON teams FOR ALL USING (
  org_id = public.user_org_id()
  AND public.user_role() = 'director'
  AND dept_id IN (SELECT d.id FROM departments d WHERE d.center_id = public.user_center_id())
);
CREATE POLICY "teams_tl_u" ON teams FOR UPDATE TO authenticated USING (
  leader_id = auth.uid() AND is_active = true AND public.user_role() = 'team_leader'
);

-- ─── PROJECTS ────────────────────────────────────────────────────────────────
CREATE POLICY "proj_r" ON projects FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "proj_m" ON projects FOR ALL USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader'));
CREATE POLICY "proj_director" ON projects FOR ALL
  USING (public.user_role() = 'director' AND org_id = public.user_org_id()
    AND dept_id IN (SELECT id FROM departments WHERE center_id = public.user_center_id()));

-- ─── PROJECT MEMBERS ─────────────────────────────────────────────────────────
CREATE POLICY "pm_r" ON project_members FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id()));
CREATE POLICY "pm_m" ON project_members FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head'));

-- ─── PROJECT DEPARTMENTS ─────────────────────────────────────────────────────
CREATE POLICY "pd_r" ON project_departments FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id()));
CREATE POLICY "pd_m" ON project_departments FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader'));

-- ─── TASKS ───────────────────────────────────────────────────────────────────
-- Admin/Leader: full | Director: scoped center | Head: scoped dept
-- Staff: task mình hoặc team mình lead | Team_leader: task team mình
CREATE POLICY "t_leader" ON tasks FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader'));
CREATE POLICY "t_director" ON tasks FOR ALL USING (
  org_id = public.user_org_id() AND public.user_role() = 'director'
  AND dept_id IN (SELECT d.id FROM departments d WHERE d.center_id = public.user_center_id())
);
CREATE POLICY "t_head_r" ON tasks FOR SELECT USING (org_id = public.user_org_id() AND public.user_role() = 'head' AND dept_id = public.user_dept_id());
CREATE POLICY "t_head_i" ON tasks FOR INSERT WITH CHECK (org_id = public.user_org_id() AND public.user_role() = 'head' AND dept_id = public.user_dept_id());
CREATE POLICY "t_head_u" ON tasks FOR UPDATE USING (org_id = public.user_org_id() AND public.user_role() = 'head' AND dept_id = public.user_dept_id());
CREATE POLICY "t_staff_r" ON tasks FOR SELECT USING (
  org_id = public.user_org_id() AND public.user_role() = 'staff'
  AND (assignee_id = auth.uid() OR team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid()))
);
CREATE POLICY "t_staff_u" ON tasks FOR UPDATE USING (
  org_id = public.user_org_id() AND public.user_role() = 'staff'
  AND (assignee_id = auth.uid() OR team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid()))
);
CREATE POLICY "t_staff_team_leader_insert" ON tasks FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.user_role() = 'staff'
    AND EXISTS(SELECT 1 FROM teams WHERE leader_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "t_tl_r" ON tasks FOR SELECT TO authenticated USING (
  public.user_role() = 'team_leader' AND org_id = public.user_org_id()
  AND (assignee_id = auth.uid() OR assigner_id = auth.uid()
    OR team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid() AND is_active = true))
);
CREATE POLICY "t_tl_i" ON tasks FOR INSERT TO authenticated WITH CHECK (
  public.user_role() = 'team_leader' AND org_id = public.user_org_id()
);
CREATE POLICY "t_tl_u" ON tasks FOR UPDATE TO authenticated USING (
  public.user_role() = 'team_leader' AND org_id = public.user_org_id()
  AND (assignee_id = auth.uid() OR assigner_id = auth.uid()
    OR team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid() AND is_active = true))
);

-- ─── TASK COMMENTS ───────────────────────────────────────────────────────────
CREATE POLICY "tc_select" ON task_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = public.user_org_id()));
CREATE POLICY "tc_insert" ON task_comments FOR INSERT
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = public.user_org_id()));
CREATE POLICY "tc_update" ON task_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "tc_delete" ON task_comments FOR DELETE
  USING (user_id = auth.uid() OR public.user_role() IN ('admin', 'leader', 'director'));
CREATE POLICY "tc_tl_r" ON task_comments FOR SELECT TO authenticated USING (
  public.user_role() = 'team_leader'
  AND task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()
    AND team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid() AND is_active = true))
);
CREATE POLICY "tc_tl_i" ON task_comments FOR INSERT TO authenticated WITH CHECK (
  public.user_role() = 'team_leader'
);

-- ─── TASK ATTACHMENTS ────────────────────────────────────────────────────────
CREATE POLICY "ta_r" ON task_attachments FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "ta_m" ON task_attachments FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head'));
CREATE POLICY "ta_insert" ON task_attachments FOR INSERT
  WITH CHECK (uploaded_by = auth.uid() AND task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "ta_d" ON task_attachments FOR DELETE
  USING (uploaded_by = auth.uid() OR public.user_role() IN ('admin', 'leader', 'director'));
CREATE POLICY "ta_delete_own" ON task_attachments FOR DELETE USING (uploaded_by = auth.uid());

-- ─── TASK STATUS LOGS ────────────────────────────────────────────────────────
CREATE POLICY "tsl_r" ON task_status_logs FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "tsl_i" ON task_status_logs FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));

-- ─── TASK SCORES ─────────────────────────────────────────────────────────────
CREATE POLICY "ts_r" ON task_scores FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "ts_m" ON task_scores FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head'));

-- ─── TASK DEPENDENCIES ──────────────────────────────────────────────────────
CREATE POLICY "td_r" ON task_dependencies FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "td_m" ON task_dependencies FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head'));

-- ─── TASK CHECKLISTS & ITEMS ─────────────────────────────────────────────────
CREATE POLICY "tcl_r" ON task_checklists FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "tcl_m" ON task_checklists FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "ci_r" ON checklist_items FOR SELECT
  USING (checklist_id IN (SELECT id FROM task_checklists));
CREATE POLICY "ci_m" ON checklist_items FOR ALL
  USING (checklist_id IN (SELECT id FROM task_checklists));

-- ─── TIME ENTRIES ────────────────────────────────────────────────────────────
CREATE POLICY "te_r" ON time_entries FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "te_own" ON time_entries FOR ALL USING (user_id = auth.uid());

-- ─── GOALS ───────────────────────────────────────────────────────────────────
CREATE POLICY "goal_r" ON goals FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "goal_m" ON goals FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director', 'head'));

-- ─── GOAL TARGETS ────────────────────────────────────────────────────────────
CREATE POLICY "gt_r" ON goal_targets FOR SELECT
  USING (goal_id IN (SELECT id FROM goals WHERE org_id = public.user_org_id()));
CREATE POLICY "gt_m" ON goal_targets FOR ALL
  USING (goal_id IN (SELECT id FROM goals WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head'));

-- ─── GOAL PROJECTS ───────────────────────────────────────────────────────────
CREATE POLICY "gp_r" ON goal_projects FOR SELECT
  USING (goal_id IN (SELECT id FROM goals WHERE org_id = public.user_org_id()));
CREATE POLICY "gp_m" ON goal_projects FOR ALL
  USING (goal_id IN (SELECT id FROM goals WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── MILESTONES ──────────────────────────────────────────────────────────────
CREATE POLICY "ms_r" ON milestones FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id()));
CREATE POLICY "ms_m" ON milestones FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head'));

-- ─── KPI CONFIGS ─────────────────────────────────────────────────────────────
CREATE POLICY "kc_r" ON kpi_configs FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "kc_m" ON kpi_configs FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── ALLOCATION CONFIGS ──────────────────────────────────────────────────────
CREATE POLICY "ac_r" ON allocation_configs FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "ac_m" ON allocation_configs FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── ALLOCATION PERIODS ──────────────────────────────────────────────────────
CREATE POLICY "ap_r" ON allocation_periods FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "ap_m" ON allocation_periods FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── ALLOCATION RESULTS ──────────────────────────────────────────────────────
CREATE POLICY "ar_r" ON allocation_results FOR SELECT
  USING (period_id IN (SELECT id FROM allocation_periods WHERE org_id = public.user_org_id()));
CREATE POLICY "ar_m" ON allocation_results FOR ALL
  USING (period_id IN (SELECT id FROM allocation_periods WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── DEPT BUDGET ALLOCATIONS ─────────────────────────────────────────────────
-- Đọc: admin/leader/director/executive xem tất cả, còn lại chỉ dept mình
-- Quản lý: admin/leader/director
CREATE POLICY "dba_r" ON dept_budget_allocations FOR SELECT
  USING (
    org_id = public.user_org_id()
    AND (
      public.user_role() IN ('admin', 'leader', 'director')
      OR public.user_is_executive()
      OR dept_id = public.user_dept_id()
    )
  );
CREATE POLICY "dba_m" ON dept_budget_allocations FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── KPI RECORDS ─────────────────────────────────────────────────────────────
CREATE POLICY "kr_r" ON kpi_records FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "kr_m" ON kpi_records FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director', 'head'));

-- ─── PROJECT KPI SUMMARY ────────────────────────────────────────────────────
CREATE POLICY "pks_r" ON project_kpi_summary FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id()));
CREATE POLICY "pks_m" ON project_kpi_summary FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── GLOBAL KPI SUMMARY ─────────────────────────────────────────────────────
CREATE POLICY "gks_r" ON global_kpi_summary FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "gks_m" ON global_kpi_summary FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
-- Mỗi user chỉ xem/sửa/xóa notification của mình, hệ thống insert cho bất kỳ ai
CREATE POLICY "notif_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_delete" ON notifications FOR DELETE USING (user_id = auth.uid());

-- ─── USER SESSIONS ───────────────────────────────────────────────────────────
CREATE POLICY "sess_own" ON user_sessions FOR ALL USING (user_id = auth.uid());

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
CREATE POLICY "audit_r" ON audit_logs FOR SELECT
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── USER INVITATIONS ────────────────────────────────────────────────────────
CREATE POLICY "inv_r" ON user_invitations FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "inv_m" ON user_invitations FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── PERMISSIONS ─────────────────────────────────────────────────────────────
CREATE POLICY "perm_r" ON permissions FOR SELECT USING (TRUE);

-- ─── CUSTOM ROLES ────────────────────────────────────────────────────────────
CREATE POLICY "cr_r" ON custom_roles FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "cr_m" ON custom_roles FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── ROLE PERMISSIONS ────────────────────────────────────────────────────────
CREATE POLICY "rp_r" ON role_permissions FOR SELECT
  USING (role_id IN (SELECT id FROM custom_roles WHERE org_id = public.user_org_id()));
CREATE POLICY "rp_m" ON role_permissions FOR ALL
  USING (role_id IN (SELECT id FROM custom_roles WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── WORKFLOW TEMPLATES ──────────────────────────────────────────────────────
CREATE POLICY "wf_r" ON workflow_templates FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "wf_m" ON workflow_templates FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director', 'head', 'team_leader'));

-- ─── WORKFLOW STEPS ──────────────────────────────────────────────────────────
CREATE POLICY "ws_r" ON workflow_steps FOR SELECT
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = public.user_org_id()));
CREATE POLICY "ws_m" ON workflow_steps FOR ALL
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head', 'team_leader'));

-- ─── WORKFLOW TRANSITIONS ────────────────────────────────────────────────────
CREATE POLICY "wt_r" ON workflow_transitions FOR SELECT
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = public.user_org_id()));
CREATE POLICY "wt_m" ON workflow_transitions FOR ALL
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head', 'team_leader'));

-- ─── TASK WORKFLOW STATE ─────────────────────────────────────────────────────
CREATE POLICY "tws_r" ON task_workflow_state FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "tws_m" ON task_workflow_state FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));

-- ─── WORKFLOW HISTORY ────────────────────────────────────────────────────────
CREATE POLICY "wh_r" ON workflow_history FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));
CREATE POLICY "wh_i" ON workflow_history FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id()));

-- ─── TASK TEMPLATES ──────────────────────────────────────────────────────────
CREATE POLICY "tt_r" ON task_templates FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "tt_m" ON task_templates FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── PROJECT TEMPLATES ───────────────────────────────────────────────────────
CREATE POLICY "pt_r" ON project_templates FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "pt_m" ON project_templates FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── INTAKE FORMS ────────────────────────────────────────────────────────────
CREATE POLICY "if_r" ON intake_forms FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "if_m" ON intake_forms FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── FORM SUBMISSIONS ───────────────────────────────────────────────────────
CREATE POLICY "fs_r" ON form_submissions FOR SELECT
  USING (form_id IN (SELECT id FROM intake_forms WHERE org_id = public.user_org_id()));
CREATE POLICY "fs_m" ON form_submissions FOR ALL
  USING (form_id IN (SELECT id FROM intake_forms WHERE org_id = public.user_org_id()));

-- ─── STATUS UPDATES ──────────────────────────────────────────────────────────
CREATE POLICY "su_r" ON status_updates FOR SELECT
  USING (
    (project_id IS NOT NULL AND project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id()))
    OR (goal_id IS NOT NULL AND goal_id IN (SELECT id FROM goals WHERE org_id = public.user_org_id()))
  );
CREATE POLICY "su_m" ON status_updates FOR ALL
  USING (
    (project_id IS NOT NULL AND project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id()))
    OR (goal_id IS NOT NULL AND goal_id IN (SELECT id FROM goals WHERE org_id = public.user_org_id()))
  );

-- ─── DASHBOARDS ──────────────────────────────────────────────────────────────
CREATE POLICY "dash_own" ON dashboards FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "dash_shared" ON dashboards FOR SELECT
  USING (org_id = public.user_org_id() AND is_shared = TRUE);

-- ─── DASHBOARD WIDGETS ───────────────────────────────────────────────────────
CREATE POLICY "dw_r" ON dashboard_widgets FOR SELECT
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE owner_id = auth.uid() OR (org_id = public.user_org_id() AND is_shared = TRUE)));
CREATE POLICY "dw_m" ON dashboard_widgets FOR ALL
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE owner_id = auth.uid()));

-- ─── ORG SETTINGS ────────────────────────────────────────────────────────────
CREATE POLICY "set_r" ON org_settings FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "set_m" ON org_settings FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader'));
CREATE POLICY "set_director" ON org_settings FOR SELECT
  USING (public.user_role() = 'director' AND org_id = public.user_org_id());

-- ─── AUTOMATION RULES ────────────────────────────────────────────────────────
CREATE POLICY "aur_r" ON automation_rules FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "aur_m" ON automation_rules FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── AUTOMATION LOGS ─────────────────────────────────────────────────────────
CREATE POLICY "atl_r" ON automation_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM automation_rules ar WHERE ar.id = rule_id AND ar.org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── TASK PROPOSALS ──────────────────────────────────────────────────────────
CREATE POLICY "tp_select" ON task_proposals FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "tp_insert" ON task_proposals FOR INSERT
  WITH CHECK (proposed_by = auth.uid() AND org_id = public.user_org_id());
CREATE POLICY "tp_update" ON task_proposals FOR UPDATE
  USING (org_id = public.user_org_id() AND (proposed_by = auth.uid() OR approver_id = auth.uid()));

-- ─── CONTRACTS ───────────────────────────────────────────────────────────────
-- Đọc: cùng org | Quản lý: tất cả user cùng org (không giới hạn role)
CREATE POLICY "ct_r" ON contracts FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "ct_m" ON contracts FOR ALL
  USING (org_id = public.user_org_id());

-- ─── CONTRACT ADDENDUMS ─────────────────────────────────────────────────────
-- Đọc: cùng org qua contract | Quản lý: tất cả user cùng org
CREATE POLICY "ca_r" ON contract_addendums FOR SELECT
  USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id()));
CREATE POLICY "ca_m" ON contract_addendums FOR ALL
  USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id()));

-- ─── BILLING MILESTONES ─────────────────────────────────────────────────────
-- Đọc: cùng org qua contract | Quản lý: tất cả user cùng org
CREATE POLICY "bm_r" ON billing_milestones FOR SELECT
  USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id()));
CREATE POLICY "bm_m" ON billing_milestones FOR ALL
  USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id()));

-- ─── REVENUE ENTRIES ─────────────────────────────────────────────────────────
-- Đọc: cùng org | Elevated: admin/leader/director full | Dept: head/tl/staff chỉ dept mình
CREATE POLICY "re_r" ON revenue_entries FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "re_manage_elevated" ON revenue_entries FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'leader', 'director')
  );
CREATE POLICY "re_manage_dept" ON revenue_entries FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('head', 'team_leader', 'staff')
    AND (
      dept_id = public.user_dept_id()
      OR created_by = auth.uid()
    )
  );

-- ─── INTERNAL REVENUE ────────────────────────────────────────────────────────
-- Đọc: cùng org | Elevated: full | Dept: head/tl/staff scoped
CREATE POLICY "ir_r" ON internal_revenue FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "ir_manage_elevated" ON internal_revenue FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'leader', 'director')
  );
CREATE POLICY "ir_manage_dept" ON internal_revenue FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('head', 'team_leader', 'staff')
    AND (
      dept_id = public.user_dept_id()
      OR created_by = auth.uid()
    )
  );

-- ─── COST ENTRIES ────────────────────────────────────────────────────────────
-- Đọc: cùng org | Elevated: full | Dept: head/tl/staff scoped
CREATE POLICY "ce_r" ON cost_entries FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "ce_manage_elevated" ON cost_entries FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'leader', 'director')
  );
CREATE POLICY "ce_manage_dept" ON cost_entries FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('head', 'team_leader', 'staff')
    AND (
      dept_id = public.user_dept_id()
      OR created_by = auth.uid()
    )
  );

-- ─── PRODUCT SERVICES ───────────────────────────────────────────────────────
-- Đọc: cùng org | Quản lý: admin/leader/director
CREATE POLICY "ps_r" ON product_services FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "ps_m" ON product_services FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── PRODUCT SERVICE CATEGORIES ──────────────────────────────────────────────
-- Đọc: cùng org | Quản lý: admin/leader/director
CREATE POLICY "psc_r" ON product_service_categories FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "psc_m" ON product_service_categories FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── REVENUE ADJUSTMENTS ────────────────────────────────────────────────────
CREATE POLICY "ra_r" ON revenue_adjustments FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "ra_m" ON revenue_adjustments FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── DEPT REVENUE ALLOCATIONS ───────────────────────────────────────────────
-- Đọc: phòng ban cùng org | Quản lý: admin/leader/director
CREATE POLICY "dra_r" ON dept_revenue_allocations FOR SELECT
  USING (dept_id IN (SELECT id FROM departments WHERE org_id = public.user_org_id()));
CREATE POLICY "dra_m" ON dept_revenue_allocations FOR ALL
  USING (public.user_role() IN ('admin', 'leader', 'director')
    AND dept_id IN (SELECT id FROM departments WHERE org_id = public.user_org_id()));

-- ─── MODULE ACCESS ───────────────────────────────────────────────────────────
-- Đọc: cùng org (sidebar cần check) | Quản lý: chỉ admin
CREATE POLICY "ma_r" ON module_access FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "ma_m" ON module_access FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- ─── ACCEPTANCE ROUNDS ──────────────────────────────────────────────────────
-- Đợt nghiệm thu nội bộ: đọc/quản lý theo org
CREATE POLICY "acr_r" ON acceptance_rounds FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "acr_m" ON acceptance_rounds FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── PERIOD PROJECT FACTORS ─────────────────────────────────────────────────
-- Hệ số khó theo dự án/đợt khoán: đọc qua allocation_periods, quản lý: elevated roles
CREATE POLICY "ppf_r" ON period_project_factors FOR SELECT
  USING (period_id IN (SELECT id FROM allocation_periods WHERE org_id = public.user_org_id()));
CREATE POLICY "ppf_m" ON period_project_factors FOR ALL
  USING (period_id IN (SELECT id FROM allocation_periods WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── ALLOCATION CYCLE CONFIG ────────────────────────────────────────────────
CREATE POLICY "acc_r" ON allocation_cycle_config FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "acc_m" ON allocation_cycle_config FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── SALARY RECORDS ──────────────────────────────────────────────────────────
CREATE POLICY "sr_r" ON salary_records FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "sr_m" ON salary_records FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── SALARY DEDUCTIONS ──────────────────────────────────────────────────────
CREATE POLICY "sd_r" ON salary_deductions FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY "sd_m" ON salary_deductions FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- ─── PROJECT DEPT FACTORS ───────────────────────────────────────────────────
-- Hệ số khó theo dự án-phòng ban
CREATE POLICY "pdf_r" ON project_dept_factors FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id()));
CREATE POLICY "pdf_m" ON project_dept_factors FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director'));
