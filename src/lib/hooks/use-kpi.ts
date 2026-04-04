// Hooks quản lý KPI: bản ghi KPI, cấu hình khoán, đợt khoán, tính & duyệt khoán

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { AllocationPeriod, AllocationConfig } from "@/lib/types";
import type { TablesInsert } from "@/lib/types/database";

const supabase = createClient();

export const kpiKeys = {
  all: ["kpi"] as const,
  records: (userId?: string) => [...kpiKeys.all, "records", userId] as const,
  allocation: () => [...kpiKeys.all, "allocation"] as const,
  periods: () => [...kpiKeys.all, "periods"] as const,
  period: (id: string) => [...kpiKeys.all, "period", id] as const,
  config: () => [...kpiKeys.all, "config"] as const,
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: kpiKeys.periods() });
      const count = data?.user_count ?? 0;
      if (count > 0) {
        toast.success(`Đã tính khoán cho ${count} nhân viên`);
      } else {
        toast.warning(
          "Không tìm thấy task hoàn thành trong kỳ. Kiểm tra lại ngày bắt đầu/kết thúc và trạng thái task."
        );
      }
    },
    onError: (e: Error) => toast.error(e.message || "Lỗi tính khoán"),
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
      toast.success("Đã xóa đợt khoán");
    },
    onError: (e: Error) => toast.error(e.message || "Lỗi xóa đợt khoán"),
  });
}
