-- Migration 012: Indexes (50+)

-- Tasks
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id) WHERE status NOT IN ('completed','cancelled');
CREATE INDEX idx_tasks_dept_status ON tasks(dept_id, status);
CREATE INDEX idx_tasks_org_status ON tasks(org_id, status);
CREATE INDEX idx_tasks_project ON tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_tasks_deadline ON tasks(deadline) WHERE status NOT IN ('completed','cancelled');
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_allocation ON tasks(allocation_id) WHERE allocation_id IS NOT NULL;
CREATE INDEX idx_tasks_search ON tasks USING gin(title gin_trgm_ops);
CREATE INDEX idx_tasks_dashboard ON tasks(org_id, dept_id, status, assignee_id) INCLUDE (title, priority, progress, deadline, kpi_weight);
CREATE INDEX idx_tasks_overdue ON tasks(deadline, status) WHERE status IN ('pending','in_progress','review') AND deadline IS NOT NULL;
CREATE INDEX idx_tasks_kpi_eval ON tasks(kpi_evaluated_at) WHERE kpi_evaluated_at IS NOT NULL;
CREATE INDEX idx_tasks_goal ON tasks(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX idx_tasks_health ON tasks(health) WHERE health IN ('yellow','red');

-- Task Related
CREATE INDEX idx_comments_task ON task_comments(task_id, created_at);
CREATE INDEX idx_attachments_task ON task_attachments(task_id);
CREATE INDEX idx_status_logs_task ON task_status_logs(task_id, changed_at DESC);
CREATE INDEX idx_scores_task ON task_scores(task_id, score_type);
CREATE INDEX idx_deps_task ON task_dependencies(task_id);
CREATE INDEX idx_deps_depends ON task_dependencies(depends_on_id);
CREATE INDEX idx_checklists_task ON task_checklists(task_id);
CREATE INDEX idx_checklist_items ON checklist_items(checklist_id, sort_order);
CREATE INDEX idx_time_task ON time_entries(task_id, start_time DESC);
CREATE INDEX idx_time_user ON time_entries(user_id, start_time DESC);

-- KPI
CREATE INDEX idx_kpi_user ON kpi_records(user_id, period, period_start DESC);
CREATE INDEX idx_kpi_dept ON kpi_records(dept_id, period, period_start DESC);
CREATE INDEX idx_pkpi ON project_kpi_summary(project_id, user_id, period, period_start DESC);
CREATE INDEX idx_gkpi ON global_kpi_summary(org_id, user_id, period, period_start DESC);

-- Allocation
CREATE INDEX idx_alloc_periods ON allocation_periods(org_id, status, period_start DESC);
CREATE INDEX idx_alloc_results ON allocation_results(period_id, weighted_score DESC);
CREATE INDEX idx_alloc_results_user ON allocation_results(user_id, calculated_at DESC);

-- Notifications
CREATE INDEX idx_notif_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

-- Projects
CREATE INDEX idx_projects_org ON projects(org_id, status);
CREATE INDEX idx_pm_user ON project_members(user_id, is_active);
CREATE INDEX idx_pm_project ON project_members(project_id, is_active);

-- Goals
CREATE INDEX idx_goals_org ON goals(org_id, goal_type, status);
CREATE INDEX idx_goals_parent ON goals(parent_goal_id) WHERE parent_goal_id IS NOT NULL;
CREATE INDEX idx_goal_targets ON goal_targets(goal_id);

-- Milestones
CREATE INDEX idx_milestones ON milestones(project_id, due_date);

-- Auth
CREATE INDEX idx_sessions ON user_sessions(user_id, status) WHERE status = 'active';
CREATE INDEX idx_invitations ON user_invitations(token) WHERE accepted_at IS NULL;

-- Audit
CREATE INDEX idx_audit_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);

-- Workflows
CREATE INDEX idx_wf_org ON workflow_templates(org_id, is_active);
CREATE INDEX idx_wf_steps ON workflow_steps(template_id, step_order);
CREATE INDEX idx_wf_state ON task_workflow_state(task_id);
CREATE INDEX idx_wf_history ON workflow_history(task_id, created_at DESC);

-- Forms
CREATE INDEX idx_forms ON intake_forms(org_id, is_active);
CREATE INDEX idx_form_sub ON form_submissions(form_id, created_at DESC);

-- Dashboards
CREATE INDEX idx_dash ON dashboards(org_id, owner_id);
CREATE INDEX idx_widgets ON dashboard_widgets(dashboard_id, sort_order);

-- Settings
CREATE INDEX idx_settings ON org_settings(org_id, category);

-- Automation
CREATE INDEX idx_auto ON automation_rules(org_id, is_active);
