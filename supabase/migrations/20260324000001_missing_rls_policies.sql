-- Migration: Add missing RLS policies for tables that have RLS enabled
-- but no policies defined (causing all queries to be blocked)

-- Project Members
DROP POLICY IF EXISTS "pm_r" ON project_members;
CREATE POLICY "pm_r" ON project_members FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "pm_m" ON project_members;
CREATE POLICY "pm_m" ON project_members FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader','head'));

-- Goals & Milestones
DROP POLICY IF EXISTS "goal_r" ON goals;
CREATE POLICY "goal_r" ON goals FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "goal_m" ON goals;
CREATE POLICY "goal_m" ON goals FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader','head'));

DROP POLICY IF EXISTS "gt_r" ON goal_targets;
CREATE POLICY "gt_r" ON goal_targets FOR SELECT
  USING (goal_id IN (SELECT id FROM goals WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "gt_m" ON goal_targets;
CREATE POLICY "gt_m" ON goal_targets FOR ALL
  USING (goal_id IN (SELECT id FROM goals WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader','head'));

DROP POLICY IF EXISTS "ms_r" ON milestones;
CREATE POLICY "ms_r" ON milestones FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "ms_m" ON milestones;
CREATE POLICY "ms_m" ON milestones FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader','head'));

-- Task Related
DROP POLICY IF EXISTS "tc_r" ON task_comments;
CREATE POLICY "tc_r" ON task_comments FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "tc_i" ON task_comments;
CREATE POLICY "tc_i" ON task_comments FOR INSERT
  WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS "tc_u" ON task_comments;
CREATE POLICY "tc_u" ON task_comments FOR UPDATE USING (user_id=auth.uid());

DROP POLICY IF EXISTS "ta_r" ON task_attachments;
CREATE POLICY "ta_r" ON task_attachments FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "ta_m" ON task_attachments;
CREATE POLICY "ta_m" ON task_attachments FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader','head'));

DROP POLICY IF EXISTS "tsl_r" ON task_status_logs;
CREATE POLICY "tsl_r" ON task_status_logs FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "tsl_i" ON task_status_logs;
CREATE POLICY "tsl_i" ON task_status_logs FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));

DROP POLICY IF EXISTS "ts_r" ON task_scores;
CREATE POLICY "ts_r" ON task_scores FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "ts_m" ON task_scores;
CREATE POLICY "ts_m" ON task_scores FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader','head'));

DROP POLICY IF EXISTS "td_r" ON task_dependencies;
CREATE POLICY "td_r" ON task_dependencies FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "td_m" ON task_dependencies;
CREATE POLICY "td_m" ON task_dependencies FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader','head'));

DROP POLICY IF EXISTS "tcl_r" ON task_checklists;
CREATE POLICY "tcl_r" ON task_checklists FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "tcl_m" ON task_checklists;
CREATE POLICY "tcl_m" ON task_checklists FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));

DROP POLICY IF EXISTS "ci_r" ON checklist_items;
CREATE POLICY "ci_r" ON checklist_items FOR SELECT
  USING (checklist_id IN (SELECT id FROM task_checklists));
DROP POLICY IF EXISTS "ci_m" ON checklist_items;
CREATE POLICY "ci_m" ON checklist_items FOR ALL
  USING (checklist_id IN (SELECT id FROM task_checklists));

DROP POLICY IF EXISTS "te_r" ON time_entries;
CREATE POLICY "te_r" ON time_entries FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "te_own" ON time_entries;
CREATE POLICY "te_own" ON time_entries FOR ALL USING (user_id=auth.uid());

-- KPI & Allocation
DROP POLICY IF EXISTS "kc_r" ON kpi_configs;
CREATE POLICY "kc_r" ON kpi_configs FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "kc_m" ON kpi_configs;
CREATE POLICY "kc_m" ON kpi_configs FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "ac_r" ON allocation_configs;
CREATE POLICY "ac_r" ON allocation_configs FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "ac_m" ON allocation_configs;
CREATE POLICY "ac_m" ON allocation_configs FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "ap_r" ON allocation_periods;
CREATE POLICY "ap_r" ON allocation_periods FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "ap_m" ON allocation_periods;
CREATE POLICY "ap_m" ON allocation_periods FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "ar_r" ON allocation_results;
CREATE POLICY "ar_r" ON allocation_results FOR SELECT
  USING (period_id IN (SELECT id FROM allocation_periods WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "ar_m" ON allocation_results;
CREATE POLICY "ar_m" ON allocation_results FOR ALL
  USING (period_id IN (SELECT id FROM allocation_periods WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "kr_r" ON kpi_records;
CREATE POLICY "kr_r" ON kpi_records FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "kr_m" ON kpi_records;
CREATE POLICY "kr_m" ON kpi_records FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader','head'));

DROP POLICY IF EXISTS "pks_r" ON project_kpi_summary;
CREATE POLICY "pks_r" ON project_kpi_summary FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "pks_m" ON project_kpi_summary;
CREATE POLICY "pks_m" ON project_kpi_summary FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "gks_r" ON global_kpi_summary;
CREATE POLICY "gks_r" ON global_kpi_summary FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "gks_m" ON global_kpi_summary;
CREATE POLICY "gks_m" ON global_kpi_summary FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Auth & Sessions
DROP POLICY IF EXISTS "sess_own" ON user_sessions;
CREATE POLICY "sess_own" ON user_sessions FOR ALL USING (user_id=auth.uid());

DROP POLICY IF EXISTS "inv_r" ON user_invitations;
CREATE POLICY "inv_r" ON user_invitations FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "inv_m" ON user_invitations;
CREATE POLICY "inv_m" ON user_invitations FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Custom Roles
DROP POLICY IF EXISTS "cr_r" ON custom_roles;
CREATE POLICY "cr_r" ON custom_roles FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "cr_m" ON custom_roles;
CREATE POLICY "cr_m" ON custom_roles FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "rp_r" ON role_permissions;
CREATE POLICY "rp_r" ON role_permissions FOR SELECT
  USING (role_id IN (SELECT id FROM custom_roles WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "rp_m" ON role_permissions;
CREATE POLICY "rp_m" ON role_permissions FOR ALL
  USING (role_id IN (SELECT id FROM custom_roles WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader'));

-- Workflow Related
DROP POLICY IF EXISTS "ws_r" ON workflow_steps;
CREATE POLICY "ws_r" ON workflow_steps FOR SELECT
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "ws_m" ON workflow_steps;
CREATE POLICY "ws_m" ON workflow_steps FOR ALL
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "wt_r" ON workflow_transitions;
CREATE POLICY "wt_r" ON workflow_transitions FOR SELECT
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "wt_m" ON workflow_transitions;
CREATE POLICY "wt_m" ON workflow_transitions FOR ALL
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id=auth.user_org_id()) AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "tws_r" ON task_workflow_state;
CREATE POLICY "tws_r" ON task_workflow_state FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "tws_m" ON task_workflow_state;
CREATE POLICY "tws_m" ON task_workflow_state FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));

DROP POLICY IF EXISTS "wh_r" ON workflow_history;
CREATE POLICY "wh_r" ON workflow_history FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "wh_i" ON workflow_history;
CREATE POLICY "wh_i" ON workflow_history FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE org_id=auth.user_org_id()));

-- Templates & Forms
DROP POLICY IF EXISTS "tt_r" ON task_templates;
CREATE POLICY "tt_r" ON task_templates FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "tt_m" ON task_templates;
CREATE POLICY "tt_m" ON task_templates FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "pt_r" ON project_templates;
CREATE POLICY "pt_r" ON project_templates FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "pt_m" ON project_templates;
CREATE POLICY "pt_m" ON project_templates FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "if_r" ON intake_forms;
CREATE POLICY "if_r" ON intake_forms FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "if_m" ON intake_forms;
CREATE POLICY "if_m" ON intake_forms FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "fs_r" ON form_submissions;
CREATE POLICY "fs_r" ON form_submissions FOR SELECT
  USING (form_id IN (SELECT id FROM intake_forms WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "fs_m" ON form_submissions;
CREATE POLICY "fs_m" ON form_submissions FOR ALL
  USING (form_id IN (SELECT id FROM intake_forms WHERE org_id=auth.user_org_id()));

-- Status Updates
DROP POLICY IF EXISTS "su_r" ON status_updates;
CREATE POLICY "su_r" ON status_updates FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id=auth.user_org_id()));
DROP POLICY IF EXISTS "su_m" ON status_updates;
CREATE POLICY "su_m" ON status_updates FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id=auth.user_org_id()));

-- Dashboard Widgets
DROP POLICY IF EXISTS "dw_r" ON dashboard_widgets;
CREATE POLICY "dw_r" ON dashboard_widgets FOR SELECT
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE owner_id=auth.uid() OR (org_id=auth.user_org_id() AND is_shared=TRUE)));
DROP POLICY IF EXISTS "dw_m" ON dashboard_widgets;
CREATE POLICY "dw_m" ON dashboard_widgets FOR ALL
  USING (dashboard_id IN (SELECT id FROM dashboards WHERE owner_id=auth.uid()));

-- Automation
DROP POLICY IF EXISTS "aur_r" ON automation_rules;
CREATE POLICY "aur_r" ON automation_rules FOR SELECT USING (org_id=auth.user_org_id());
DROP POLICY IF EXISTS "aur_m" ON automation_rules;
CREATE POLICY "aur_m" ON automation_rules FOR ALL USING (org_id=auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

DROP POLICY IF EXISTS "al_r" ON automation_logs;
CREATE POLICY "al_r" ON automation_logs FOR SELECT
  USING (rule_id IN (SELECT id FROM automation_rules WHERE org_id=auth.user_org_id()));
