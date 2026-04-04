import type { Json } from './database';
import type { WorkflowStepType, UserRole } from './enums';

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
  on_complete_actions: Json[];
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
