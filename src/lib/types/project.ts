import type { Json } from './database';
import type { ProjectStatus, HealthScore } from './enums';
import type { User, Department, DepartmentSummary } from './organization';

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
  metadata: Record<string, Json | undefined>;
  created_at: string;
  deleted_at: string | null;
  // Joined
  manager?: User;
  department?: Department;
  departments?: { dept: DepartmentSummary }[];
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

export interface MilestoneUpdateInput {
  title?: string;
  description?: string | null;
  due_date?: string;
  status?: 'upcoming' | 'reached' | 'missed';
  reached_at?: string | null;
}
