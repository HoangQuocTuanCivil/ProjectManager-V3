import type {
  RevenueDimension, RecognitionMethod, RevenueSource,
  InternalRevenueStatus, CostCategory,
  RevenueEntryStatus, ProductServiceCategory,
} from './enums';
import type { User, Department } from './organization';
import type { Project } from './project';
import type { Contract, ContractAddendum } from './contract';

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
  product_service_id?: string | null;
  addendum_id?: string | null;
  recognition_date?: string;
  status?: RevenueEntryStatus;
  completion_percentage?: number | null;
  original_entry_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  project?: Pick<Project, 'id' | 'code' | 'name'>;
  contract?: Pick<Contract, 'id' | 'contract_no' | 'title'>;
  department?: Pick<Department, 'id' | 'name' | 'code'>;
  creator?: Pick<User, 'id' | 'full_name'>;
  product_service?: Pick<ProductService, 'id' | 'code' | 'name' | 'category'>;
  addendum?: Pick<ContractAddendum, 'id' | 'addendum_no' | 'title'>;
  original_entry?: Pick<RevenueEntry, 'id' | 'description' | 'amount'>;
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
  project?: Pick<Project, 'id' | 'code' | 'name'>;
  contract?: Pick<Contract, 'id' | 'contract_no' | 'title'>;
  department?: Pick<Department, 'id' | 'name' | 'code'>;
  creator?: Pick<User, 'id' | 'full_name'>;
}

export interface PSCategory {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductService {
  id: string;
  org_id: string;
  code: string;
  name: string;
  category: ProductServiceCategory;
  unit_price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RevenueAdjustment {
  id: string;
  org_id: string;
  contract_id: string;
  addendum_id: string;
  revenue_entry_id: string | null;
  old_amount: number;
  new_amount: number;
  adjustment_amount: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
  contract?: Pick<Contract, 'id' | 'contract_no' | 'title'>;
  addendum?: Pick<ContractAddendum, 'id' | 'addendum_no' | 'title'>;
  revenue_entry?: Pick<RevenueEntry, 'id' | 'description' | 'amount'>;
  adjuster?: Pick<User, 'id' | 'full_name'>;
}

export interface DeptRevenueAllocation {
  id: string;
  revenue_entry_id: string;
  dept_id: string;
  project_id: string | null;
  allocation_percentage: number;
  allocated_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  department?: Pick<Department, 'id' | 'name' | 'code'>;
  project?: Pick<Project, 'id' | 'code' | 'name'>;
  revenue_entry?: Pick<RevenueEntry, 'id' | 'description' | 'amount' | 'status'>;
}

export interface RevenueSummary {
  total: number;
  draft: number;
  byDimension: Record<string, number>;
  byMethod: Record<string, number>;
  bySource: Record<string, number>;
  growthRate: number | null;
}

export interface RevenueForecast {
  total_confirmed: number;
  total_pending: number;
  projected_from_milestones: number;
  periods: Array<{
    period: string;
    projected_amount: number;
    milestone_count: number;
  }>;
}
