import type { Json } from './database';
import type { TaskStatus, TaskPriority, TaskType, DependencyType, HealthScore } from './enums';
import type { User, Department, Team } from './organization';
import type { Project } from './project';
import type { TaskWorkflowState } from './workflow';

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
  metadata: Record<string, Json | undefined>;
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
  project_id?: string | null;
  assignee_id?: string | null;
  dept_id?: string;
  priority: TaskPriority;
  task_type: TaskType;
  kpi_weight: number;
  expect_quality: number;
  expect_difficulty: number;
  expect_volume?: number;
  expect_ahead?: number;
  start_date?: string;
  deadline?: string;
  parent_task_id?: string;
  team_id?: string | null;
  template_id?: string;
  metadata?: Record<string, Json | undefined>;
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
  default_checklist: Json[];
  default_tags: string[];
}

export interface TaskFilters {
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  project_id?: string | 'all';
  assignee_id?: string | 'all';
  team_id?: string | 'all';
  search?: string;
  date_range?: { start: string; end: string };
}
