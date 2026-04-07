import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PSCategory } from "@/lib/types";

const keys = {
  all: ["ps-categories"] as const,
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function usePSCategories() {
  return useQuery({
    queryKey: keys.all,
    queryFn: () => apiFetch<PSCategory[]>("/api/product-service-categories"),
    staleTime: 60_000,
  });
}

export function useCreatePSCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { slug: string; name: string; color?: string }) =>
      apiFetch<PSCategory>("/api/product-service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdatePSCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<PSCategory>) =>
      apiFetch<PSCategory>(`/api/product-service-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeletePSCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<PSCategory>(`/api/product-service-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
