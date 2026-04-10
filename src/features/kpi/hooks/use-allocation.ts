// Hooks: cấu hình khoán, đợt khoán, giao khoán phòng ban

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { AllocationPeriod, AllocationConfig, DeptBudgetAllocation } from "@/lib/types";
import type { TablesInsert } from "@/lib/types/database";
import { kpiKeys } from "./kpi-keys";

const supabase = createClient();

/** Lấy tất cả cấu hình khoán (toàn công ty + từng trung tâm) */
export function useAllocationConfigs() {
  return useQuery({
    queryKey: kpiKeys.configs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allocation_configs")
        .select("*, center:centers(id, name, code)")
        .eq("is_active", true)
        .order("center_id", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data as unknown as (AllocationConfig & { center: { id: string; name: string; code: string } | null })[];
    },
  });
}

/** Lấy cấu hình khoán theo trung tâm (null = toàn công ty) */
export function useAllocationConfig(centerId?: string | null) {
  return useQuery({
    queryKey: kpiKeys.config(centerId),
    queryFn: async () => {
      let query = supabase
        .from("allocation_configs")
        .select("*")
        .eq("is_active", true);

      if (centerId) {
        query = query.eq("center_id", centerId);
      } else {
        query = query.is("center_id", null);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as AllocationConfig | null;
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
        .select("*, project:projects(id, code, name, budget, allocation_fund), contract:contracts!contract_id(id, contract_no, title, contract_value), department:departments(id, name, code), center:centers(id, name, code), creator:users!created_by(id, full_name)")
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
    mutationFn: async (input: { project_id: string; contract_id?: string; dept_id?: string; center_id?: string; allocated_amount: number; delivery_progress?: number; delivery_date?: string; start_date?: string; end_date?: string; allocation_code?: string; task_document_url?: string; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
      if (!profile) throw new Error("Không tìm thấy profile");

      const row: Record<string, any> = {
        org_id: profile.org_id,
        project_id: input.project_id,
        contract_id: input.contract_id || null,
        allocated_amount: input.allocated_amount,
        delivery_progress: input.delivery_progress ?? 0,
        delivery_date: input.delivery_date || null,
        start_date: input.start_date || null,
        end_date: input.end_date || null,
        allocation_code: input.allocation_code || null,
        task_document_url: input.task_document_url || null,
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

      // Tạo HĐ đầu vào (incoming) — mỗi giao khoán = 1 chi phí riêng
      // 1 HĐ đầu ra có thể sinh nhiều HĐ đầu vào (nhiều PB/TT khác nhau)
      if (data && input.contract_id) {
        const { data: srcContract } = await supabase
          .from("contracts")
          .select("contract_no, title")
          .eq("id", input.contract_id)
          .single();

        // Đếm số giao khoán đã có cho HĐ gốc để tạo mã tuần tự
        const { count } = await supabase
          .from("dept_budget_allocations")
          .select("id", { count: "exact", head: true })
          .eq("contract_id", input.contract_id);
        const seq = String(count ?? 1).padStart(2, "0");

        // Mã HĐ đầu vào: dùng allocation_code nếu có, ngược lại sinh tự động
        const baseNo = srcContract?.contract_no || "HD";
        const incomingNo = input.allocation_code || `GK-${baseNo}-${seq}`;

        // Tên đơn vị nhận giao khoán (TT hoặc PB)
        const targetLabel = input.center_id
          ? (await supabase.from("centers").select("name").eq("id", input.center_id).single()).data?.name
          : input.dept_id
          ? (await supabase.from("departments").select("name").eq("id", input.dept_id).single()).data?.name
          : "";

        await supabase.from("contracts").insert({
          org_id: profile.org_id,
          project_id: input.project_id,
          contract_type: "incoming",
          contract_no: incomingNo,
          title: `GK: ${srcContract?.title || ""} → ${targetLabel || ""}`,
          contract_value: input.allocated_amount,
          status: "active",
          start_date: input.delivery_date || null,
          notes: input.note || null,
          parent_contract_id: input.contract_id,
          source_allocation_id: data.id,
          created_by: user!.id,
        } as any);
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kpiKeys.budgetAllocations() });
      // Cập nhật danh sách HĐ để tab incoming hiện HĐ đầu vào mới
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

/** Xóa giao khoán và HĐ đầu vào liên quan (source_allocation_id trỏ ngược về allocation) */
export function useDeleteDeptBudgetAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Xóa HĐ đầu vào được sinh từ giao khoán này
      await supabase.from("contracts").delete().eq("source_allocation_id", id);
      const { error } = await supabase.from("dept_budget_allocations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kpiKeys.budgetAllocations() });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

/** Cập nhật giao khoán (đơn vị nhận, số tiền, thời gian) và đồng bộ HĐ đầu vào liên quan */
export function useUpdateDeptBudgetAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      dept_id?: string | null;
      center_id?: string | null;
      allocated_amount?: number;
      start_date?: string | null;
      end_date?: string | null;
    }) => {
      const { id, ...updates } = input;
      const row: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.dept_id !== undefined) row.dept_id = updates.dept_id || null;
      if (updates.center_id !== undefined) row.center_id = updates.center_id || null;
      if (updates.allocated_amount !== undefined) row.allocated_amount = updates.allocated_amount;
      if (updates.start_date !== undefined) row.start_date = updates.start_date || null;
      if (updates.end_date !== undefined) row.end_date = updates.end_date || null;

      const { error } = await supabase
        .from("dept_budget_allocations")
        .update(row)
        .eq("id", id);
      if (error) throw error;

      // Đồng bộ HĐ đầu vào liên kết qua source_allocation_id
      const contractUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.allocated_amount !== undefined) contractUpdate.contract_value = updates.allocated_amount;
      if (updates.start_date !== undefined) contractUpdate.start_date = updates.start_date || null;
      if (updates.end_date !== undefined) contractUpdate.end_date = updates.end_date || null;

      // Cập nhật title nếu đơn vị nhận thay đổi
      if (updates.center_id !== undefined || updates.dept_id !== undefined) {
        const targetId = updates.center_id || updates.dept_id;
        const table = updates.center_id ? "centers" : "departments";
        if (targetId) {
          const { data: target } = await supabase.from(table).select("name").eq("id", targetId).single();
          if (target) {
            // Lấy title gốc từ HĐ đầu ra để cập nhật title incoming
            const { data: linked } = await supabase
              .from("contracts")
              .select("parent_contract_id")
              .eq("source_allocation_id", id)
              .single() as { data: { parent_contract_id: string | null } | null; error: any };
            if (linked?.parent_contract_id) {
              const { data: parent } = await supabase.from("contracts").select("title").eq("id", linked.parent_contract_id).single();
              if (parent) contractUpdate.title = `GK: ${parent.title} → ${target.name}`;
            }
          }
        }
      }

      await supabase.from("contracts").update(contractUpdate).eq("source_allocation_id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kpiKeys.budgetAllocations() });
      qc.invalidateQueries({ queryKey: ["contracts"] });
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
