-- ═══════════════════════════════════════════════════════════════════════════════
-- FK ON DELETE: thêm ON DELETE SET NULL cho tất cả FK hiện đang RESTRICT
-- Phân nhóm: user refs, dept refs, project refs, config refs, workflow refs
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper: DROP + ADD constraint an toàn
-- PostgreSQL inline FK tự tạo tên: {table}_{column}_fkey

-- ─── USER REFERENCES (audit/creator columns) → SET NULL ──────────────────────

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_manager_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_owner_id_fkey;
ALTER TABLE goals ADD CONSTRAINT goals_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigner_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigner_id_fkey
  FOREIGN KEY (assigner_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ALTER COLUMN assigner_id DROP NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_kpi_evaluated_by_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_kpi_evaluated_by_fkey
  FOREIGN KEY (kpi_evaluated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE task_proposals DROP CONSTRAINT IF EXISTS task_proposals_proposed_by_fkey;
ALTER TABLE task_proposals ADD CONSTRAINT task_proposals_proposed_by_fkey
  FOREIGN KEY (proposed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE task_proposals ALTER COLUMN proposed_by DROP NOT NULL;

ALTER TABLE task_proposals DROP CONSTRAINT IF EXISTS task_proposals_approver_id_fkey;
ALTER TABLE task_proposals ADD CONSTRAINT task_proposals_approver_id_fkey
  FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE task_proposals ALTER COLUMN approver_id DROP NOT NULL;

ALTER TABLE task_comments DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey;
ALTER TABLE task_comments ADD CONSTRAINT task_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE task_comments ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE task_attachments DROP CONSTRAINT IF EXISTS task_attachments_uploaded_by_fkey;
ALTER TABLE task_attachments ADD CONSTRAINT task_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE task_attachments ALTER COLUMN uploaded_by DROP NOT NULL;

ALTER TABLE task_status_logs DROP CONSTRAINT IF EXISTS task_status_logs_changed_by_fkey;
ALTER TABLE task_status_logs ADD CONSTRAINT task_status_logs_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE task_status_logs ALTER COLUMN changed_by DROP NOT NULL;

ALTER TABLE task_scores DROP CONSTRAINT IF EXISTS task_scores_scored_by_fkey;
ALTER TABLE task_scores ADD CONSTRAINT task_scores_scored_by_fkey
  FOREIGN KEY (scored_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE task_scores ALTER COLUMN scored_by DROP NOT NULL;

ALTER TABLE checklist_items DROP CONSTRAINT IF EXISTS checklist_items_assignee_id_fkey;
ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE time_entries ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE allocation_periods DROP CONSTRAINT IF EXISTS allocation_periods_approved_by_fkey;
ALTER TABLE allocation_periods ADD CONSTRAINT allocation_periods_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE allocation_results DROP CONSTRAINT IF EXISTS allocation_results_user_id_fkey;
ALTER TABLE allocation_results ADD CONSTRAINT allocation_results_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE allocation_results ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE dept_budget_allocations DROP CONSTRAINT IF EXISTS dept_budget_allocations_created_by_fkey;
ALTER TABLE dept_budget_allocations ADD CONSTRAINT dept_budget_allocations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE dept_budget_allocations ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE salary_records DROP CONSTRAINT IF EXISTS salary_records_user_id_fkey;
ALTER TABLE salary_records ADD CONSTRAINT salary_records_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE salary_records ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE salary_records DROP CONSTRAINT IF EXISTS salary_records_created_by_fkey;
ALTER TABLE salary_records ADD CONSTRAINT salary_records_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE salary_records ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE salary_deductions DROP CONSTRAINT IF EXISTS salary_deductions_user_id_fkey;
ALTER TABLE salary_deductions ADD CONSTRAINT salary_deductions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE salary_deductions ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_created_by_fkey;
ALTER TABLE contracts ADD CONSTRAINT contracts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contracts ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE contract_addendums DROP CONSTRAINT IF EXISTS contract_addendums_created_by_fkey;
ALTER TABLE contract_addendums ADD CONSTRAINT contract_addendums_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contract_addendums ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE acceptance_rounds DROP CONSTRAINT IF EXISTS acceptance_rounds_created_by_fkey;
ALTER TABLE acceptance_rounds ADD CONSTRAINT acceptance_rounds_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE acceptance_rounds ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE revenue_entries DROP CONSTRAINT IF EXISTS revenue_entries_created_by_fkey;
ALTER TABLE revenue_entries ADD CONSTRAINT revenue_entries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE revenue_entries ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE internal_revenue DROP CONSTRAINT IF EXISTS internal_revenue_created_by_fkey;
ALTER TABLE internal_revenue ADD CONSTRAINT internal_revenue_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE internal_revenue ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE cost_entries DROP CONSTRAINT IF EXISTS cost_entries_created_by_fkey;
ALTER TABLE cost_entries ADD CONSTRAINT cost_entries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cost_entries ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE revenue_adjustments DROP CONSTRAINT IF EXISTS revenue_adjustments_adjusted_by_fkey;
ALTER TABLE revenue_adjustments ADD CONSTRAINT revenue_adjustments_adjusted_by_fkey
  FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE revenue_adjustments ALTER COLUMN adjusted_by DROP NOT NULL;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_invited_by_fkey;
ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE user_invitations ALTER COLUMN invited_by DROP NOT NULL;

ALTER TABLE workflow_templates DROP CONSTRAINT IF EXISTS workflow_templates_created_by_fkey;
ALTER TABLE workflow_templates ADD CONSTRAINT workflow_templates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE workflow_steps DROP CONSTRAINT IF EXISTS workflow_steps_assigned_user_id_fkey;
ALTER TABLE workflow_steps ADD CONSTRAINT workflow_steps_assigned_user_id_fkey
  FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE task_workflow_state DROP CONSTRAINT IF EXISTS task_workflow_state_completed_by_fkey;
ALTER TABLE task_workflow_state ADD CONSTRAINT task_workflow_state_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE workflow_history DROP CONSTRAINT IF EXISTS workflow_history_actor_id_fkey;
ALTER TABLE workflow_history ADD CONSTRAINT workflow_history_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE task_templates DROP CONSTRAINT IF EXISTS task_templates_created_by_fkey;
ALTER TABLE task_templates ADD CONSTRAINT task_templates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE project_templates DROP CONSTRAINT IF EXISTS project_templates_created_by_fkey;
ALTER TABLE project_templates ADD CONSTRAINT project_templates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE intake_forms DROP CONSTRAINT IF EXISTS intake_forms_auto_assign_to_fkey;
ALTER TABLE intake_forms ADD CONSTRAINT intake_forms_auto_assign_to_fkey
  FOREIGN KEY (auto_assign_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE intake_forms DROP CONSTRAINT IF EXISTS intake_forms_created_by_fkey;
ALTER TABLE intake_forms ADD CONSTRAINT intake_forms_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE form_submissions DROP CONSTRAINT IF EXISTS form_submissions_submitted_by_fkey;
ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE status_updates DROP CONSTRAINT IF EXISTS status_updates_author_id_fkey;
ALTER TABLE status_updates ADD CONSTRAINT status_updates_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE status_updates ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE dashboards DROP CONSTRAINT IF EXISTS dashboards_owner_id_fkey;
ALTER TABLE dashboards ADD CONSTRAINT dashboards_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_created_by_fkey;
ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE org_settings DROP CONSTRAINT IF EXISTS org_settings_updated_by_fkey;
ALTER TABLE org_settings ADD CONSTRAINT org_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ─── DEPARTMENT REFERENCES → SET NULL ────────────────────────────────────────

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_dept_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_dept_id_fkey
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_dept_id_fkey;
ALTER TABLE goals ADD CONSTRAINT goals_dept_id_fkey
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_dept_id_fkey;
ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_dept_id_fkey
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE workflow_templates DROP CONSTRAINT IF EXISTS workflow_templates_dept_id_fkey;
ALTER TABLE workflow_templates ADD CONSTRAINT workflow_templates_dept_id_fkey
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE intake_forms DROP CONSTRAINT IF EXISTS intake_forms_target_dept_id_fkey;
ALTER TABLE intake_forms ADD CONSTRAINT intake_forms_target_dept_id_fkey
  FOREIGN KEY (target_dept_id) REFERENCES departments(id) ON DELETE SET NULL;

-- ─── PROJECT REFERENCES → SET NULL ───────────────────────────────────────────

ALTER TABLE allocation_periods DROP CONSTRAINT IF EXISTS allocation_periods_project_id_fkey;
ALTER TABLE allocation_periods ADD CONSTRAINT allocation_periods_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE allocation_results DROP CONSTRAINT IF EXISTS allocation_results_project_id_fkey;
ALTER TABLE allocation_results ADD CONSTRAINT allocation_results_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE workflow_templates DROP CONSTRAINT IF EXISTS workflow_templates_project_id_fkey;
ALTER TABLE workflow_templates ADD CONSTRAINT workflow_templates_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE intake_forms DROP CONSTRAINT IF EXISTS intake_forms_target_project_id_fkey;
ALTER TABLE intake_forms ADD CONSTRAINT intake_forms_target_project_id_fkey
  FOREIGN KEY (target_project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_project_id_fkey;
ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- ─── CONFIG/DEPT REFERENCES → SET NULL ───────────────────────────────────────

ALTER TABLE allocation_periods DROP CONSTRAINT IF EXISTS allocation_periods_config_id_fkey;
ALTER TABLE allocation_periods ADD CONSTRAINT allocation_periods_config_id_fkey
  FOREIGN KEY (config_id) REFERENCES allocation_configs(id) ON DELETE SET NULL;
ALTER TABLE allocation_periods ALTER COLUMN config_id DROP NOT NULL;

ALTER TABLE allocation_periods DROP CONSTRAINT IF EXISTS allocation_periods_dept_id_fkey;
ALTER TABLE allocation_periods ADD CONSTRAINT allocation_periods_dept_id_fkey
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL;

-- ─── WORKFLOW REFERENCES → SET NULL ──────────────────────────────────────────

ALTER TABLE workflow_steps DROP CONSTRAINT IF EXISTS workflow_steps_assigned_custom_role_fkey;
ALTER TABLE workflow_steps ADD CONSTRAINT workflow_steps_assigned_custom_role_fkey
  FOREIGN KEY (assigned_custom_role) REFERENCES custom_roles(id) ON DELETE SET NULL;

ALTER TABLE task_workflow_state DROP CONSTRAINT IF EXISTS task_workflow_state_template_id_fkey;
ALTER TABLE task_workflow_state ADD CONSTRAINT task_workflow_state_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE;

ALTER TABLE task_workflow_state DROP CONSTRAINT IF EXISTS task_workflow_state_current_step_id_fkey;
ALTER TABLE task_workflow_state ADD CONSTRAINT task_workflow_state_current_step_id_fkey
  FOREIGN KEY (current_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE;

ALTER TABLE workflow_history DROP CONSTRAINT IF EXISTS workflow_history_step_id_fkey;
ALTER TABLE workflow_history ADD CONSTRAINT workflow_history_step_id_fkey
  FOREIGN KEY (step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE;
