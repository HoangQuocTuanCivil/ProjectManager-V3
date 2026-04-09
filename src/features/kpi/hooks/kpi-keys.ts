// Shared query key factory for all KPI-related hooks

export const kpiKeys = {
  all: ["kpi"] as const,
  records: (userId?: string) => [...kpiKeys.all, "records", userId] as const,
  allocation: () => [...kpiKeys.all, "allocation"] as const,
  periods: () => [...kpiKeys.all, "periods"] as const,
  period: (id: string) => [...kpiKeys.all, "period", id] as const,
  configs: () => [...kpiKeys.all, "configs"] as const,
  config: (centerId?: string | null) => [...kpiKeys.all, "config", centerId] as const,
  budgetAllocations: (projectId?: string) => [...kpiKeys.all, "budget-alloc", projectId] as const,
  fundSummary: (filters?: { start_date?: string; end_date?: string }) => [...kpiKeys.all, "fund-summary", filters] as const,
  employeeBonus: (periodId?: string) => [...kpiKeys.all, "employee-bonus", periodId] as const,
  cycle: () => [...kpiKeys.all, "cycle"] as const,
  salary: (filters?: Record<string, string | undefined>) => [...kpiKeys.all, "salary", filters] as const,
  deductions: () => [...kpiKeys.all, "deductions"] as const,
  acceptanceRounds: (ids?: string[]) => [...kpiKeys.all, "acceptance-rounds", ids] as const,
};
