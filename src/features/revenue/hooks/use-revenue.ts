import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { RevenueEntry, InternalRevenue, CostEntry } from "@/lib/types";

const supabase = createClient();

export const revenueKeys = {
  all: ["revenue"] as const,
  entries: (filters?: { projectId?: string; dimension?: string }) => [...revenueKeys.all, "entries", filters] as const,
  internal: (filters?: { projectId?: string; deptId?: string }) => [...revenueKeys.all, "internal", filters] as const,
  costs: (filters?: { projectId?: string; category?: string }) => [...revenueKeys.all, "costs", filters] as const,
};

async function getOrgId() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
  if (!profile) throw new Error("Không tìm thấy profile");
  return { userId: user!.id, orgId: profile.org_id };
}

/* ───── Revenue Entries (Doanh thu công ty) ────────────────────── */

export function useRevenueEntries(filters?: { projectId?: string; dimension?: string }) {
  return useQuery({
    queryKey: revenueKeys.entries(filters),
    queryFn: async () => {
      let query = supabase
        .from("revenue_entries")
        .select("*, project:projects(id, code, name), contract:contracts(id, contract_no, title), department:departments(id, name, code), creator:users!created_by(id, full_name)")
        .order("created_at", { ascending: false });
      if (filters?.projectId) query = query.eq("project_id", filters.projectId);
      if (filters?.dimension) query = query.eq("dimension", filters.dimension);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as RevenueEntry[];
    },
  });
}

export function useCreateRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<RevenueEntry, 'id' | 'org_id' | 'created_by' | 'created_at' | 'updated_at' | 'project' | 'contract' | 'department' | 'creator'>) => {
      const { userId, orgId } = await getOrgId();
      const { data, error } = await supabase
        .from("revenue_entries")
        .insert({ ...input, org_id: orgId, created_by: userId })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: revenueKeys.all }),
  });
}

export function useDeleteRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("revenue_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: revenueKeys.all }),
  });
}

/* ───── Internal Revenue (Doanh thu nội bộ) ────────────────────── */

export function useInternalRevenue(filters?: { projectId?: string; deptId?: string }) {
  return useQuery({
    queryKey: revenueKeys.internal(filters),
    queryFn: async () => {
      let query = supabase
        .from("internal_revenue")
        .select("*, project:projects(id, code, name), department:departments(id, name, code), creator:users!created_by(id, full_name)")
        .order("created_at", { ascending: false });
      if (filters?.projectId) query = query.eq("project_id", filters.projectId);
      if (filters?.deptId) query = query.eq("dept_id", filters.deptId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as InternalRevenue[];
    },
  });
}

export function useCreateInternalRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<InternalRevenue, 'id' | 'org_id' | 'created_by' | 'created_at' | 'updated_at' | 'project' | 'department' | 'creator'>) => {
      const { userId, orgId } = await getOrgId();
      const total = Math.round(Number(input.unit_price) * Number(input.quantity));
      const { data, error } = await supabase
        .from("internal_revenue")
        .insert({ ...input, total_amount: total, org_id: orgId, created_by: userId })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: revenueKeys.all }),
  });
}

export function useUpdateInternalRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<InternalRevenue>) => {
      const { data, error } = await supabase
        .from("internal_revenue")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: revenueKeys.all }),
  });
}

export function useDeleteInternalRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("internal_revenue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: revenueKeys.all }),
  });
}

/* ───── Cost Entries (Chi phí) ─────────────────────────────────── */

export function useCostEntries(filters?: { projectId?: string; category?: string }) {
  return useQuery({
    queryKey: revenueKeys.costs(filters),
    queryFn: async () => {
      let query = supabase
        .from("cost_entries")
        .select("*, project:projects(id, code, name), contract:contracts(id, contract_no, title), department:departments(id, name, code), creator:users!created_by(id, full_name)")
        .order("created_at", { ascending: false });
      if (filters?.projectId) query = query.eq("project_id", filters.projectId);
      if (filters?.category) query = query.eq("category", filters.category);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as CostEntry[];
    },
  });
}

export function useCreateCostEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CostEntry, 'id' | 'org_id' | 'created_by' | 'created_at' | 'updated_at' | 'project' | 'contract' | 'department' | 'creator'>) => {
      const { userId, orgId } = await getOrgId();
      const { data, error } = await supabase
        .from("cost_entries")
        .insert({ ...input, org_id: orgId, created_by: userId })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: revenueKeys.all }),
  });
}

export function useDeleteCostEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: revenueKeys.all }),
  });
}
