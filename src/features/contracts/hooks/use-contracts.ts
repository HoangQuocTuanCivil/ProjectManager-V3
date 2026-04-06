import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Contract, ContractAddendum, BillingMilestone } from "@/lib/types";

const supabase = createClient();

export const contractKeys = {
  all: ["contracts"] as const,
  list: (projectId?: string) => [...contractKeys.all, "list", projectId] as const,
  detail: (id: string) => [...contractKeys.all, "detail", id] as const,
};

/* ───── Contracts ──────────────────────────────────────────────── */

/** Danh sách hợp đồng, có thể lọc theo dự án */
export function useContracts(projectId?: string) {
  return useQuery({
    queryKey: contractKeys.list(projectId),
    queryFn: async () => {
      let query = supabase
        .from("contracts")
        .select("*, project:projects(id, code, name, budget), creator:users!created_by(id, full_name), addendums:contract_addendums(*, creator:users!created_by(id, full_name)), milestones:billing_milestones(*)")
        .order("created_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Contract[];
    },
  });
}

/** Chi tiết hợp đồng kèm phụ lục + mốc thanh toán */
export function useContract(id: string) {
  return useQuery({
    queryKey: contractKeys.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, project:projects(id, code, name, budget), creator:users!created_by(id, full_name), addendums:contract_addendums(*, creator:users!created_by(id, full_name)), milestones:billing_milestones(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as Contract;
    },
  });
}

/** Tạo hợp đồng */
export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      contract_no: string;
      title: string;
      client_name?: string;
      contract_value: number;
      signed_date?: string;
      start_date?: string;
      end_date?: string;
      guarantee_value?: number;
      guarantee_expiry?: string;
      status?: string;
      file_url?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
      if (!profile) throw new Error("Không tìm thấy profile");

      const { data, error } = await supabase
        .from("contracts")
        .insert({ ...input, org_id: profile.org_id, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contractKeys.all }),
  });
}

/** Cập nhật hợp đồng */
export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Contract>) => {
      const { data, error } = await supabase
        .from("contracts")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contractKeys.all }),
  });
}

/** Xóa hợp đồng */
export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contractKeys.all }),
  });
}

/* ───── Addendums ──────────────────────────────────────────────── */

/** Tạo phụ lục hợp đồng, tự cập nhật ngân sách dự án */
export function useCreateAddendum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      contract_id: string;
      addendum_no: string;
      title: string;
      value_change: number;
      new_end_date?: string;
      description?: string;
      signed_date?: string;
      file_url?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Insert addendum — trigger fn_revenue_adjustment() tự động:
      //   1. Cập nhật contracts.contract_value + projects.budget
      //   2. Tạo revenue_adjustments (audit trail)
      //   3. Tạo revenue_entries draft cho phần chênh lệch
      const { data, error } = await supabase
        .from("contract_addendums")
        .insert({ ...input, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Xóa phụ lục */
export function useDeleteAddendum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, contract_id }: { id: string; contract_id: string }) => {
      // Get the addendum value_change to reverse it
      const { data: addendum } = await supabase
        .from("contract_addendums")
        .select("value_change")
        .eq("id", id)
        .single();

      const { error } = await supabase.from("contract_addendums").delete().eq("id", id);
      if (error) throw error;

      // Reverse the value change on contract & project
      if (addendum) {
        const { data: contract } = await supabase
          .from("contracts")
          .select("id, contract_value, project_id")
          .eq("id", contract_id)
          .single();
        if (contract) {
          const newValue = Number(contract.contract_value) - Number(addendum.value_change);
          await supabase.from("contracts").update({ contract_value: newValue, updated_at: new Date().toISOString() }).eq("id", contract.id);
          await supabase.from("projects").update({ budget: newValue, updated_at: new Date().toISOString() }).eq("id", contract.project_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/* ───── Billing Milestones ─────────────────────────────────────── */

/** Tạo mốc thanh toán */
export function useCreateBillingMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      contract_id: string;
      title: string;
      percentage: number;
      amount: number;
      due_date?: string;
      invoice_no?: string;
      sort_order?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("billing_milestones")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contractKeys.all }),
  });
}

/** Cập nhật mốc thanh toán (đổi trạng thái, ghi nhận thanh toán) */
export function useUpdateBillingMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<BillingMilestone>) => {
      const { data, error } = await supabase
        .from("billing_milestones")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contractKeys.all }),
  });
}

/** Xóa mốc thanh toán */
export function useDeleteBillingMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("billing_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contractKeys.all }),
  });
}
