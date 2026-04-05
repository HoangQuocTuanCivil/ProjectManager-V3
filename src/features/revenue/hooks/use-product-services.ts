import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProductService } from "@/lib/types";

const psKeys = {
  all: ["product-services"] as const,
  list: (filters?: Record<string, string | undefined>) => [...psKeys.all, "list", filters] as const,
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function useProductServices(filters?: {
  category?: string; is_active?: string; search?: string; page?: number; per_page?: number;
}) {
  return useQuery({
    queryKey: psKeys.list(filters as Record<string, string | undefined>),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v !== undefined && v !== "") params.set(k, String(v));
        }
      }
      return apiFetch<{ data: ProductService[]; count: number; page: number; per_page: number }>(
        `/api/product-services?${params}`
      );
    },
  });
}

export function useCreateProductService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ProductService, 'id' | 'org_id' | 'created_at' | 'updated_at'>) =>
      apiFetch<ProductService>("/api/product-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: psKeys.all }),
  });
}

export function useUpdateProductService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<ProductService>) =>
      apiFetch<ProductService>(`/api/product-services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: psKeys.all }),
  });
}

export function useDeleteProductService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ProductService>(`/api/product-services/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: psKeys.all }),
  });
}
