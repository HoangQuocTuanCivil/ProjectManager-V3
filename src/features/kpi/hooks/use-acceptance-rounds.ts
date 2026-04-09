// Hooks: nghiệm thu giao khoán

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AcceptanceRound } from "@/lib/types";
import { kpiKeys } from "./kpi-keys";

/** Batch fetch đợt nghiệm thu cho danh sách giao khoán */
export function useAcceptanceRounds(allocationIds: string[]) {
  return useQuery({
    queryKey: kpiKeys.acceptanceRounds(allocationIds),
    enabled: allocationIds.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("allocation_ids", allocationIds.join(","));
      const res = await fetch(`/api/kpi/acceptance-rounds?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<AcceptanceRound[]>;
    },
  });
}

/** Tạo hoặc cập nhật đợt nghiệm thu */
export function useUpsertAcceptanceRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      allocation_id: string;
      round_name: string;
      amount: number;
      round_date?: string;
      note?: string;
      sort_order?: number;
    }) => {
      const method = input.id ? "PATCH" : "POST";
      const res = await fetch("/api/kpi/acceptance-rounds", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...kpiKeys.all, "acceptance-rounds"] }),
  });
}

/** Xóa đợt nghiệm thu */
export function useDeleteAcceptanceRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/kpi/acceptance-rounds?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...kpiKeys.all, "acceptance-rounds"] }),
  });
}
