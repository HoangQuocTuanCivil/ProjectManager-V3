import { useQuery } from "@tanstack/react-query";
import type { RevenueAdjustment } from "@/lib/types";

const adjustmentKeys = {
  all: ["revenue", "adjustments"] as const,
  list: (filters?: Record<string, string | undefined>) => [...adjustmentKeys.all, "list", filters] as const,
  byContract: (contractId: string) => [...adjustmentKeys.all, "contract", contractId] as const,
};

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function useRevenueAdjustments(filters?: { page?: number; per_page?: number }) {
  return useQuery({
    queryKey: adjustmentKeys.list(filters as Record<string, string | undefined>),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.per_page) params.set("per_page", String(filters.per_page));
      return apiFetch<{ data: RevenueAdjustment[]; count: number; page: number; per_page: number }>(
        `/api/revenue/adjustments?${params}`
      );
    },
  });
}

export function useAdjustmentsByContract(contractId: string) {
  return useQuery({
    queryKey: adjustmentKeys.byContract(contractId),
    queryFn: () => apiFetch<{ data: RevenueAdjustment[]; count: number }>(
      `/api/revenue/adjustments?contract_id=${contractId}`
    ),
    enabled: !!contractId,
  });
}
