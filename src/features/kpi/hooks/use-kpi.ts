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
        .select("*, project:projects(id, code, name, budget, allocation_fund), department:departments(id, name, code), creator:users!created_by(id, full_name)")
        .order("created_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as DeptBudgetAllocation[];
    },
  });
}

/** Tạo / cập nhật giao khoán cho phòng ban (upsert theo project_id + dept_id) */
export function useUpsertDeptBudgetAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; dept_id: string; allocated_amount: number; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
      if (!profile) throw new Error("Không tìm thấy profile");

      const { data, error } = await supabase
        .from("dept_budget_allocations")
        .upsert({
          org_id: profile.org_id,
          project_id: input.project_id,
          dept_id: input.dept_id,
          allocated_amount: input.allocated_amount,
          note: input.note || null,
          created_by: user!.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "project_id,dept_id" })
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
