import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { RevenueEntry, InternalRevenue, CostEntry } from "@/lib/types";
import { PAGINATION } from "@/lib/constants/app";

const supabase = createClient();

export const revenueKeys = {
  all: ["revenue"] as const,
  entries: (filters?: Record<string, string | undefined>) => [...revenueKeys.all, "entries", filters] as const,
  entry: (id: string) => [...revenueKeys.all, "entry", id] as const,
  internal: (filters?: Record<string, string | undefined>) => [...revenueKeys.all, "internal", filters] as const,
  costs: (filters?: Record<string, string | undefined>) => [...revenueKeys.all, "costs", filters] as const,
};

async function getOrgId() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
  if (!profile) throw new Error("Không tìm thấy profile");
  return { userId: user!.id, orgId: profile.org_id };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function invalidateRevenueDeps(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: revenueKeys.all });
  qc.invalidateQueries({ queryKey: ["projects"] });
  qc.invalidateQueries({ queryKey: ["contracts"] });
  qc.invalidateQueries({ queryKey: ["reports"] });
  qc.invalidateQueries({ queryKey: ["kpi", "fund-summary"] });
}

/* ───── Revenue Entries ──────────────────────────────────────── */

export function useRevenueEntries(filters?: {
  status?: string; dimension?: string; project_id?: string; dept_id?: string;
  date_from?: string; date_to?: string; search?: string;
  page?: number; per_page?: number;
}) {
  return useQuery({
    queryKey: revenueKeys.entries(filters as Record<string, string | undefined>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v !== undefined && v !== "") params.set(k, String(v));
        }
      }
      return apiFetch<{ data: RevenueEntry[]; count: number; page: number; per_page: number }>(
        `/api/revenue?${params}`
      );
    },
  });
}

export function useCreateRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<RevenueEntry, 'id' | 'org_id' | 'created_by' | 'created_at' | 'updated_at' | 'project' | 'contract' | 'department' | 'creator' | 'product_service' | 'addendum' | 'original_entry'>) =>
      apiFetch<RevenueEntry>("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateRevenueDeps(qc),
  });
}

export function useUpdateRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<RevenueEntry>) =>
      apiFetch<RevenueEntry>(`/api/revenue/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    onSuccess: () => invalidateRevenueDeps(qc),
  });
}

export function useDeleteRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/revenue/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateRevenueDeps(qc),
  });
}

export function useConfirmRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/revenue/${id}/confirm`, { method: "POST" }),
    onSuccess: () => invalidateRevenueDeps(qc),
  });
}

export function useCancelRevenueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/revenue/${id}/cancel`, { method: "POST" }),
    onSuccess: () => invalidateRevenueDeps(qc),
  });
}

/* ───── Internal Revenue ──────────────────────────────────────── */

export function useInternalRevenue(filters?: {
  projectId?: string;
  deptId?: string;
  page?: number;
  per_page?: number;
}) {
  const filterKey = { projectId: filters?.projectId, deptId: filters?.deptId, page: String(filters?.page ?? 1) };
  return useQuery({
    queryKey: revenueKeys.internal(filterKey as Record<string, string | undefined>),
    queryFn: async () => {
      const page = filters?.page ?? 1;
      const perPage = filters?.per_page ?? PAGINATION.DEFAULT_PAGE_SIZE;
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      let query = supabase
        .from("internal_revenue")
        .select("*, project:projects(id, code, name), department:departments(id, name, code), creator:users!created_by(id, full_name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (filters?.projectId) query = query.eq("project_id", filters.projectId);
      if (filters?.deptId) query = query.eq("dept_id", filters.deptId);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as unknown as InternalRevenue[], count, page, per_page: perPage };
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
    onSuccess: () => invalidateRevenueDeps(qc),
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
    onSuccess: () => invalidateRevenueDeps(qc),
  });
}

export function useDeleteInternalRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("internal_revenue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateRevenueDeps(qc),
  });
}

/* ───── Cost Entries ──────────────────────────────────────────── */

export function useCostEntries(filters?: {
  projectId?: string;
  category?: string;
  page?: number;
  per_page?: number;
}) {
  const filterKey = { projectId: filters?.projectId, category: filters?.category, page: String(filters?.page ?? 1) };
  return useQuery({
    queryKey: revenueKeys.costs(filterKey as Record<string, string | undefined>),
    queryFn: async () => {
      const page = filters?.page ?? 1;
      const perPage = filters?.per_page ?? PAGINATION.DEFAULT_PAGE_SIZE;
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      let query = supabase
        .from("cost_entries")
        .select("*, project:projects(id, code, name), contract:contracts(id, contract_no, title), department:departments(id, name, code), creator:users!created_by(id, full_name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (filters?.projectId) query = query.eq("project_id", filters.projectId);
      if (filters?.category) query = query.eq("category", filters.category);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as unknown as CostEntry[], count, page, per_page: perPage };
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
    onSuccess: () => invalidateRevenueDeps(qc),
  });
}

export function useDeleteCostEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateRevenueDeps(qc),
  });
}
