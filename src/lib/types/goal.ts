import type { GoalType, GoalStatus } from './enums';
import type { User } from './organization';

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

export interface GoalCreateInput {
  title: string;
  description?: string | null;
  goal_type?: GoalType;
  status?: GoalStatus;
  owner_id?: string | null;
  dept_id?: string | null;
  parent_goal_id?: string | null;
  period_label?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  progress?: number;
  progress_source?: string;
  is_public?: boolean;
  color?: string;
}
