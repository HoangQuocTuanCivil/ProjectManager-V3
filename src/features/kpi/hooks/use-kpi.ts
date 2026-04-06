// Hooks quản lý KPI: bản ghi KPI, cấu hình khoán, đợt khoán, tính & duyệt khoán

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { AllocationPeriod, AllocationConfig, DeptBudgetAllocation } from "@/lib/types";
import type { TablesInsert } from "@/lib/types/database";

const supabase = createClient();

export const kpiKeys = {
  all: ["kpi"] as const,
  records: (userId?: string) => [...kpiKeys.all, "records", userId] as const,
  allocation: () => [...kpiKeys.all, "allocation"] as const,
  periods: () => [...kpiKeys.all, "periods"] as const,
  period: (id: string) => [...kpiKeys.all, "period", id] as const,
  config: () => [...kpiKeys.all, "config"] as const,
  budgetAllocations: (projectId?: string) => [...kpiKeys.all, "budget-alloc", projectId] as const,
  fundSummary: () => [...kpiKeys.all, "fund-summary"] as const,
  employeeBonus: (periodId?: string) => [...kpiKeys.all, "employee-bonus", periodId] as const,
  cycle: () => [...kpiKeys.all, "cycle"] as const,
  salary: (filters?: Record<string, string | undefined>) => [...kpiKeys.all, "salary", filters] as const,
  deductions: () => [...kpiKeys.all, "deductions"] as const,
};

/** Lấy danh sách bản ghi KPI, có thể lọc theo user */
export function useKPIRecords(userId?: string) {
  return useQuery({
    queryKey: kpiKeys.records(userId),
    queryFn: async () => {
      let query = supabase
        .from("kpi_records")
        .select("*")
        .order("period_start", { ascending: false })
        .limit(20);
      if (userId) query = query.eq("user_id", userId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/** Lấy cấu hình khoán đang hoạt động */
export function useAllocationConfig() {
  return useQuery({
    queryKey: kpiKeys.config(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allocation_configs")
        .select("*")
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data as AllocationConfig;
    },
  });
}

/** Lấy tất cả đợt khoán kèm cấu hình, dự án và kết quả */
export function useAllocationPeriods() {
  return useQuery({
    queryKey: kpiKeys.periods(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allocation_periods")
        .select(
          "*, config:allocation_configs(*), project:projects(code, name), results:allocation_results(*, user:users(id, full_name, avatar_url, role))"
        )
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as unknown as AllocationPeriod[];
    },
  });
}

/** Tạo đợt khoán mới, tự tạo cấu hình mặc định nếu chưa có */
export function useCreateAllocationPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<AllocationPeriod>) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user!.id)
        .single();
      if (!profile) throw new Error("Không tìm thấy profile");

      // Lấy cấu hình hiện tại hoặc tạo mặc định
      let { data: config } = await supabase
        .from("allocation_configs")
        .select("id")
        .eq("org_id", profile.org_id)
        .eq("is_active", true)
        .single();
      if (!config) {
        const { data: newConfig, error: cfgErr } = await supabase
          .from("allocation_configs")
          .insert({
            org_id: profile.org_id,
            name: "Cấu hình mặc định",
            weight_volume: 0.4,
            weight_quality: 0.3,
            weight_difficulty: 0.2,
            weight_ahead: 0.1,
          })
          .select("id")
          .single();
        if (cfgErr)
          throw new Error("Vui lòng tạo cấu hình KPI trước (tab Cấu hình)");
        config = newConfig;
      }

      const { data, error } = await supabase
        .from("allocation_periods")
        .insert({
          ...input,
          org_id: profile.org_id,
          config_id: config!.id,
        } as TablesInsert<'allocation_periods'>)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.periods() }),
  });
}

/** Gọi RPC tính khoán cho đợt, trả về số nhân viên được tính */
export function useCalculateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      periodId,
      useActual = true,
    }: {
      periodId: string;
      useActual?: boolean;
    }) => {
      const { data, error } = (await supabase.rpc("fn_allocate_smart", {
        p_period_id: periodId,
        p_use_actual: useActual,
      })) as { data: { user_count?: number; error?: string } | null; error: { message: string } | null };
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { user_count?: number; error?: string } | null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kpiKeys.periods() });
    },
  });
}

/** Duyệt đợt khoán */
export function useApproveAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("allocation_periods")
        .update({
          status: "approved",
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", periodId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.periods() }),
  });
}

/** Xóa đợt khoán và kết quả liên quan */
export function useDeleteAllocationPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      await supabase
        .from("allocation_results")
        .delete()
        .eq("period_id", periodId);
      const { error } = await supabase
        .from("allocation_periods")
        .delete()
        .eq("id", periodId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kpiKeys.periods() });
    },
  });
}

/* ───── Dept Budget Allocation (Giao khoán) ───────────────────── */

/** Lấy danh sách giao khoán theo phòng ban, có thể lọc theo dự án */
export function useDeptBudgetAllocations(projectId?: string) {
  return useQuery({
    queryKey: kpiKeys.budgetAllocations(projectId),
    queryFn: async () => {
      let query = supabase
        .from("dept_budget_allocations")
        .select("*, project:projects(id, code, name, budget, allocation_fund), department:departments(id, name, code), center:centers(id, name, code), creator:users!created_by(id, full_name)")
        .order("created_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as DeptBudgetAllocation[];
    },
  });
}

/** Tạo / cập nhật giao khoán cho trung tâm hoặc phòng ban */
export function useUpsertDeptBudgetAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; dept_id?: string; center_id?: string; allocated_amount: number; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
      if (!profile) throw new Error("Không tìm thấy profile");

      // Insert — unique index (project+dept hoặc project+center) ngăn trùng
      const row: Record<string, any> = {
        org_id: profile.org_id,
        project_id: input.project_id,
        allocated_amount: input.allocated_amount,
        note: input.note || null,
        created_by: user!.id,
      };
      if (input.dept_id) row.dept_id = input.dept_id;
      if (input.center_id) row.center_id = input.center_id;

      const { data, error } = await supabase
        .from("dept_budget_allocations")
        .insert(row as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.budgetAllocations() }),
  });
}

/** Xóa giao khoán phòng ban */
export function useDeleteDeptBudgetAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dept_budget_allocations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.budgetAllocations() }),
  });
}

/* ───── Fund Summary, Bonus, Cycle, Salary ──────────────────────── */

/** Bảng tổng hợp quỹ PB: dự kiến / thực tế / chi phí / lương / còn lại */
export function useFundSummary() {
  return useQuery({
    queryKey: kpiKeys.fundSummary(),
    queryFn: async () => {
      const res = await fetch("/api/kpi/allocation/fund-summary");
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

/** Cấu hình kỳ khoán (3/6 tháng) — mỗi org 1 bản ghi */
export function useAllocationCycle() {
  return useQuery({
    queryKey: kpiKeys.cycle(),
    queryFn: async () => {
      const res = await fetch("/api/allocation-cycle");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{ id: string; org_id: string; cycle_months: number; start_month: number; is_active: boolean } | null>;
    },
  });
}

/** Cập nhật cấu hình kỳ khoán */
export function useUpdateAllocationCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cycle_months: number; start_month: number; is_active?: boolean }) => {
      const res = await fetch("/api/allocation-cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.cycle() }),
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
      qc.invalidateQueries({ queryKey: kpiKeys.employeeBonus() });
      qc.invalidateQueries({ queryKey: kpiKeys.fundSummary() });
    },
  });
}

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
