import type { Json } from './database';
import type { AllocationMode, AllocationStatus, KPIVerdict } from './enums';
import type { User, Department } from './organization';
import type { Project } from './project';

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

export interface DeptBudgetAllocation {
  id: string;
  org_id: string;
  project_id: string;
  contract_id: string | null;
  dept_id: string;
  allocated_amount: number;
  delivery_progress: number;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  project?: Pick<Project, 'id' | 'code' | 'name' | 'budget' | 'allocation_fund'>;
  contract?: { id: string; contract_no: string; title: string };
  department?: Pick<Department, 'id' | 'name' | 'code'>;
  creator?: Pick<User, 'id' | 'full_name'>;
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
  breakdown: Record<string, Json | undefined>;
  user?: User;
}
