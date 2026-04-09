// Hooks: quỹ phân bổ, thưởng nhân viên, preview quỹ khoán

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kpiKeys } from "./kpi-keys";

/** Tổng hợp quỹ PB, hỗ trợ lọc theo khoảng ngày (start_date, end_date) */
export function useFundSummary(filters?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: kpiKeys.fundSummary(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.start_date) params.set("start_date", filters.start_date);
      if (filters?.end_date) params.set("end_date", filters.end_date);
      const res = await fetch(`/api/kpi/allocation/fund-summary?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{
        dept_id: string; org_id: string; dept_name: string; dept_code: string;
        expected_fund: number; actual_revenue: number; internal_rev: number;
        total_costs: number; total_salary: number; net_fund: number;
      }[]>;
    },
  });
}

/** Bảng thưởng/nợ cá nhân — filter theo đợt khoán */
export function useEmployeeBonus(periodId?: string) {
  return useQuery({
    queryKey: kpiKeys.employeeBonus(periodId),
    enabled: !!periodId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) params.set("period_id", periodId);
      const res = await fetch(`/api/kpi/allocation/employee-bonus?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const json = await res.json();
      return (json.data ?? json) as {
        result_id: string; period_id: string; period_name: string;
        period_start: string; period_end: string; org_id: string;
        user_id: string; full_name: string; email: string;
        dept_id: string; dept_name: string;
        allocated_amount: number; total_salary: number;
        bonus_amount: number; deduction_remaining: number;
        outcome: "bonus" | "deduction" | "balanced";
      }[];
    },
  });
}

/** Gọi fn_calc_bonus cho 1 đợt khoán */
export function useCalculateBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      const res = await fetch("/api/kpi/allocation/calculate-bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id: periodId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kpiKeys.periods() });
      qc.invalidateQueries({ queryKey: [...kpiKeys.all, "employee-bonus"] });
      qc.invalidateQueries({ queryKey: kpiKeys.fundSummary() });
    },
  });
}

/** Preview quỹ khoán: tổng NT theo dự án cho TT trong khoảng ngày */
export function usePreviewFund(params: { center_id?: string; start_date?: string; end_date?: string; project_id?: string }) {
  const hasParams = !!(params.center_id && params.start_date && params.end_date);
  return useQuery({
    queryKey: [...kpiKeys.all, "preview-fund", params],
    enabled: hasParams,
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params.center_id) sp.set("center_id", params.center_id);
      if (params.start_date) sp.set("start_date", params.start_date);
      if (params.end_date) sp.set("end_date", params.end_date);
      if (params.project_id) sp.set("project_id", params.project_id);
      const res = await fetch(`/api/kpi/allocation/preview-fund?${sp}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{
        project_id: string; project_code: string; project_name: string;
        allocations: { id: string; allocation_code: string; allocated_amount: number; accepted_in_period: number }[];
        total_accepted: number;
      }[]>;
    },
  });
}
