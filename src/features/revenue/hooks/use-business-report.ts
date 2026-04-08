import { useQuery } from "@tanstack/react-query";

export type GroupBy = "company" | "center" | "department" | "product_service";

export interface BusinessRow {
  id: string;
  name: string;
  code: string;
  revenue: number;
  cogs: number;
  selling: number;
  admin: number;
  financial: number;
  salary: number;
  incoming: number;
  total_cost: number;
  profit: number;
  margin: number;
}

export interface BusinessTotals {
  revenue: number;
  cogs: number;
  selling: number;
  admin: number;
  financial: number;
  salary: number;
  incoming: number;
  total_cost: number;
  profit: number;
  margin: number;
}

export interface BusinessReportData {
  rows: BusinessRow[];
  totals: BusinessTotals;
}

export interface BusinessReportFilters {
  group_by?: GroupBy;
  center_id?: string;
  dept_id?: string;
  from?: string;
  to?: string;
}

function buildUrl(filters: BusinessReportFilters): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/api/reports/business?${qs}` : "/api/reports/business";
}

export function useBusinessReport(filters: BusinessReportFilters = {}) {
  return useQuery({
    queryKey: ["reports", "business", filters],
    queryFn: async () => {
      const res = await fetch(buildUrl(filters));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json as BusinessReportData;
    },
    staleTime: 30_000,
  });
}
