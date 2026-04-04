import type { RevenueDimension, RecognitionMethod, RevenueSource, InternalRevenueStatus, CostCategory } from './enums';
import type { User, Department } from './organization';
import type { Project } from './project';
import type { Contract } from './contract';

export interface RevenueEntry {
  id: string;
  org_id: string;
  project_id: string | null;
  contract_id: string | null;
  dept_id: string | null;
  dimension: RevenueDimension;
  method: RecognitionMethod;
  source: RevenueSource;
  source_id: string | null;
  amount: number;
  description: string;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  project?: Pick<Project, 'id' | 'code' | 'name'>;
  contract?: Pick<Contract, 'id' | 'contract_no' | 'title'>;
  department?: Pick<Department, 'id' | 'name' | 'code'>;
  creator?: Pick<User, 'id' | 'full_name'>;
}

export interface InternalRevenue {
  id: string;
  org_id: string;
  project_id: string | null;
  dept_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_amount: number;
  status: InternalRevenueStatus;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  project?: Pick<Project, 'id' | 'code' | 'name'>;
  department?: Pick<Department, 'id' | 'name' | 'code'>;
  creator?: Pick<User, 'id' | 'full_name'>;
}

export interface CostEntry {
  id: string;
  org_id: string;
  project_id: string | null;
  contract_id: string | null;
  dept_id: string | null;
  category: CostCategory;
  description: string;
  amount: number;
  budget_amount: number;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  project?: Pick<Project, 'id' | 'code' | 'name'>;
  contract?: Pick<Contract, 'id' | 'contract_no' | 'title'>;
  department?: Pick<Department, 'id' | 'name' | 'code'>;
  creator?: Pick<User, 'id' | 'full_name'>;
}
