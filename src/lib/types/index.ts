export type UserRole = 'admin' | 'director' | 'leader' | 'head' | 'team_leader' | 'staff';
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'overdue' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'task' | 'product';
export type PeriodType = 'week' | 'month' | 'quarter' | 'year';
export type AllocationMode = 'per_project' | 'global';
export type AllocationStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'rejected';
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived';
export type GoalType = 'company' | 'center' | 'department' | 'team' | 'personal';
export type GoalStatus = 'on_track' | 'at_risk' | 'off_track' | 'achieved' | 'cancelled';
export type HealthScore = 'green' | 'yellow' | 'red' | 'gray';
export type DependencyType = 'blocking' | 'waiting_on' | 'related';
export type WorkflowStepType = 'create' | 'assign' | 'execute' | 'submit' | 'review' | 'approve' | 'reject' | 'revise' | 'calculate' | 'notify' | 'archive' | 'custom';
export type KPIVerdict = 'exceptional' | 'exceeded' | 'near_target' | 'below_target' | 'pending';

export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  settings: Record<string, any>;
  created_at: string;
}

export interface Department {
  id: string;
  org_id: string;
  center_id: string | null;
  name: string;
  code: string;
  description: string | null;
  head_user_id: string | null;
  sort_order: number;
  is_active: boolean;
  // Joined
  head?: User;
  center?: Center;
  member_count?: number;
  teams?: Team[];
}

export interface Team {
  id: string;
  org_id: string;
  dept_id: string;
  name: string;
  code: string | null;
  description: string | null;
  leader_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  // Joined
  leader?: User;
  department?: Department;
  member_count?: number;
}

export interface Center {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  description: string | null;
  director_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  // Joined
  director?: User;
  departments?: Department[];
  member_count?: number;
}

export interface User {
  id: string;
  org_id: string;
  dept_id: string | null;
  center_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  job_title: string | null;
  is_active: boolean;
  custom_role_id: string | null;
  team_id: string | null;
  last_login: string | null;
  login_count: number;
  settings: UserSettings;
  created_at: string;
  // Joined
  department?: Department;
  center?: Center;
  team?: Team;
}

export interface UserSettings {
  notifications_email: boolean;
  notifications_push: boolean;
  language: string;
  theme: 'light' | 'dark' | 'system';
}

export interface Project {
  id: string;
  org_id: string;
  code: string;
  name: string;
  description: string | null;
  dept_id: string | null;
  manager_id: string | null;
  status: ProjectStatus;
  budget: number;
  allocation_fund: number;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  client: string | null;
  contract_no: string | null;
  metadata: Record<string, any>;
  created_at: string;
  // Joined
  manager?: User;
  department?: Department;
  departments?: { dept: Department }[];
  member_count?: number;
  task_count?: number;
  progress?: number;
  health?: HealthScore;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'manager' | 'leader' | 'engineer' | 'reviewer';
  is_active: boolean;
  joined_at: string;
  user?: User;
}

export interface Task {
  id: string;
  org_id: string;
  dept_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assigner_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  task_type: TaskType;
  kpi_weight: number;
  progress: number;
  // KPI Expected (set at assignment)
  expect_volume: number;
  expect_quality: number;
  expect_difficulty: number;
  expect_ahead: number;
  expect_score: number;
  // KPI Actual (set at review)
  actual_volume: number;
  actual_quality: number;
  actual_difficulty: number;
  actual_ahead: number;
  actual_score: number;
  // Variance
  kpi_variance: number | null;
  kpi_evaluated_by: string | null;
  kpi_evaluated_at: string | null;
  kpi_note: string | null;
  // Dates
  start_date: string | null;
  deadline: string | null;
  completed_at: string | null;
  // Hierarchy
  parent_task_id: string | null;
  milestone_id: string | null;
  goal_id: string | null;
  allocation_id: string | null;
  // Time
  estimate_hours: number | null;
  actual_hours: number | null;
  // Flags
  health: HealthScore;
  is_milestone: boolean;
  is_recurring: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  team_id: string | null;
  // Joined
  assignee?: User;
  assigner?: User;
  project?: Project;
  department?: Department;
  team?: Team;
  comments_count?: number;
  attachments_count?: number;
  dependencies?: TaskDependency[];
  checklists?: TaskChecklist[];
  tags?: string[];
  comments?: TaskComment[];
  workflow_state?: TaskWorkflowState;
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  project_id?: string;
  assignee_id?: string;
  dept_id?: string;
  priority: TaskPriority;
  task_type: TaskType;
  kpi_weight: number;
  expect_quality: number;
  expect_difficulty: number;
  start_date?: string;
  deadline?: string;
  parent_task_id?: string;
  team_id?: string;
  template_id?: string;
  metadata?: Record<string, any>;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
  dependency_type: DependencyType;
  depends_on?: Task;
}

export interface TaskChecklist {
  id: string;
  task_id: string;
  title: string;
  sort_order: number;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  content: string;
  is_checked: boolean;
  assignee_id: string | null;
  due_date: string | null;
  sort_order: number;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface KPIScores {
  volume: number;
  quality: number;
  difficulty: number;
  ahead: number;
  total: number;
}

export interface KPIComparison {
  expected: KPIScores;
  actual: KPIScores;
  variance: number;
  verdict: KPIVerdict;
}

export interface AllocationConfig {
  id: string;
  org_id: string;
  name: string;
  weight_volume: number;
  weight_quality: number;
  weight_difficulty: number;
  weight_ahead: number;
  is_active: boolean;
}

export interface AllocationPeriod {
  id: string;
  org_id: string;
  config_id: string;
  name: string;
  project_id: string | null;
  total_fund: number;
  period_start: string;
  period_end: string;
  mode: AllocationMode;
  status: AllocationStatus;
  approved_by: string | null;
  config?: AllocationConfig;
  project?: Project;
  results?: AllocationResult[];
}

export interface AllocationResult {
  id: string;
  period_id: string;
  user_id: string;
  project_id: string | null;
  mode: AllocationMode;
  avg_volume: number;
  avg_quality: number;
  avg_difficulty: number;
  avg_ahead: number;
  weighted_score: number;
  share_percentage: number;
  allocated_amount: number;
  task_count: number;
  breakdown: Record<string, any>;
  user?: User;
}

export interface Goal {
  id: string;
  org_id: string;
  parent_goal_id: string | null;
  title: string;
  description: string | null;
  goal_type: GoalType;
  status: GoalStatus;
  owner_id: string | null;
  dept_id: string | null;
  period_label: string | null;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  progress_source: string;
  is_public: boolean;
  color: string;
  owner?: User;
  targets?: GoalTarget[];
  sub_goals?: Goal[];
}

export interface GoalTarget {
  id: string;
  goal_id: string;
  title: string;
  target_type: string;
  start_value: number;
  current_value: number;
  target_value: number;
  unit: string | null;
  is_completed: boolean;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: 'upcoming' | 'reached' | 'missed';
  reached_at: string | null;
  goal_id: string | null;
}

export interface WorkflowTemplate {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  scope: 'global' | 'department' | 'project' | 'task_type';
  is_active: boolean;
  is_default: boolean;
  steps?: WorkflowStep[];
  transitions?: WorkflowTransition[];
}

export interface WorkflowStep {
  id: string;
  template_id: string;
  step_order: number;
  name: string;
  step_type: WorkflowStepType;
  assigned_role: UserRole | null;
  is_automatic: boolean;
  sla_hours: number | null;
  on_complete_actions: any[];
  color: string | null;
}

export interface WorkflowTransition {
  id: string;
  from_step_id: string;
  to_step_id: string;
  condition_type: string;
  label: string | null;
}

export interface TaskWorkflowState {
  task_id: string;
  template_id: string;
  current_step_id: string;
  entered_at: string;
  completed_at: string | null;
  result: string | null;
  current_step?: WorkflowStep;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface TaskTemplate {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  default_title: string | null;
  default_priority: TaskPriority;
  default_type: TaskType;
  default_kpi_weight: number;
  default_estimate_hours: number | null;
  default_expect_quality: number;
  default_expect_difficulty: number;
  default_checklist: any[];
  default_tags: string[];
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_type: 'chart' | 'number' | 'task_list' | 'goal' | 'workload' | 'kpi_ring';
  title: string | null;
  config: Record<string, any>;
  position: { x: number; y: number; w: number; h: number };
}

export interface OrgSetting {
  id: string;
  org_id: string;
  category: string;
  key: string;
  value: any;
  description: string | null;
}

export interface Permission {
  id: string;
  group_name: string;
  name: string;
  sort_order: number;
}

export interface CustomRole {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string;
  base_role: UserRole;
  permissions?: Permission[];
}

export type TaskView = 'grid' | 'kanban' | 'gantt' | 'calendar' | 'workload';
export type SettingsTab = 'accounts' | 'roles' | 'depts' | 'teams' | 'workflows' | 'kpi' | 'templates' | 'notifications' | 'security';

export interface TaskFilters {
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  project_id?: string | 'all';
  assignee_id?: string | 'all';
  team_id?: string | 'all';
  search?: string;
  date_range?: { start: string; end: string };
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  count?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  per_page: number;
  total: number;
}
