import type { ContractType, ContractStatus, BillingMilestoneStatus } from './enums';
import type { User } from './organization';
import type { Project } from './project';

export interface Contract {
  id: string;
  org_id: string;
  project_id: string;
  contract_type: ContractType;
  contract_no: string;
  title: string;
  client_name: string | null;
  bid_package: string | null;
  contract_value: number;
  vat_value: number;
  signed_date: string | null;
  start_date: string | null;
  end_date: string | null;
  guarantee_value: number;
  guarantee_expiry: string | null;
  status: ContractStatus;
  file_url: string | null;
  notes: string | null;
  subcontractor_name: string | null;
  work_content: string | null;
  person_in_charge: string | null;
  contract_scope: string;
  product_service_id: string | null;
  parent_contract_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  project?: Pick<Project, 'id' | 'code' | 'name' | 'budget'>;
  creator?: Pick<User, 'id' | 'full_name'>;
  parent_contract?: Pick<Contract, 'id' | 'contract_no' | 'title'> | null;
  addendums?: ContractAddendum[];
  milestones?: BillingMilestone[];
}

export interface ContractAddendum {
  id: string;
  contract_id: string;
  addendum_no: string;
  title: string;
  addendum_value: number;
  value_change: number;
  new_end_date: string | null;
  description: string | null;
  signed_date: string | null;
  file_url: string | null;
  created_by: string;
  created_at: string;
  // Joined
  creator?: Pick<User, 'id' | 'full_name'>;
}

export interface BillingMilestone {
  id: string;
  contract_id: string;
  title: string;
  percentage: number;
  amount: number;
  payable_amount: number;
  paid_amount: number;
  due_date: string | null;
  status: BillingMilestoneStatus;
  paid_date: string | null;
  invoice_no: string | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
