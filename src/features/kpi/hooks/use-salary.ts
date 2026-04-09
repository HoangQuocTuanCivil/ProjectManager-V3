// Hooks: bảng lương, khấu trừ

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kpiKeys } from "./kpi-keys";

/** Danh sách bảng lương — filter tháng / PB / NV */
export function useSalaryRecords(filters?: { month?: string; dept_id?: string; user_id?: string }) {
  return useQuery({
    queryKey: kpiKeys.salary(filters as Record<string, string | undefined>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.month) params.set("month", filters.month);
      if (filters?.dept_id) params.set("dept_id", filters.dept_id);
      if (filters?.user_id) params.set("user_id", filters.user_id);
      params.set("per_page", "200");
      const res = await fetch(`/api/salary?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{ data: any[]; count: number }>;
    },
  });
}

/** Nhập lương hàng loạt */
export function useCreateSalaryBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: { user_id: string; dept_id?: string; month: string; base_salary: number; notes?: string }[]) => {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.salary() }),
  });
}

/** Danh sách khấu trừ lương */
export function useSalaryDeductions() {
  return useQuery({
    queryKey: kpiKeys.deductions(),
    queryFn: async () => {
      const res = await fetch("/api/salary/deductions?per_page=100");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{ data: any[]; count: number }>;
    },
  });
}
