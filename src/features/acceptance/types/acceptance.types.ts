import type { Task, User, Project, KPIVerdict } from "@/lib/types";


export interface AcceptanceRecord {
  id: string;                // task_id
  task: Task;
  project?: Project;
  assignee?: User;
  evaluator?: User;
  // KPI
  expect_score: number;
  actual_score: number;
  kpi_variance: number;
  verdict: KPIVerdict;
  kpi_note: string | null;
  // Dates
  submitted_at: string | null;   // task moved to "review"
  evaluated_at: string | null;   // kpi_evaluated_at
  deadline: string | null;
  // Payment
  payment_status: PaymentStatus;
  payment_amount: number | null;
  payment_date: string | null;
  payment_note: string | null;
}

export type PaymentStatus = "unpaid" | "pending_payment" | "paid" | "rejected";

export type AcceptanceStatus = "pending" | "accepted" | "rejected" | "revision";


export interface AcceptanceFilter {
  project_id?: string;
  assignee_id?: string;
  status?: AcceptanceStatus | "all";
  payment_status?: PaymentStatus | "all";
  date_range?: { start: string; end: string };
}


export interface AcceptanceSummary {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  avgKpiE: number;
  avgKpiA: number;
  avgVariance: number;
  totalPayment: number;
  paidAmount: number;
}
