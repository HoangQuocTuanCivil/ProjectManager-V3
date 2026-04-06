import { useQuery } from "@tanstack/react-query";
import type { RevenueSummary, RevenueForecast } from "@/lib/types";

const analyticsKeys = {
  all: ["revenue", "analytics"] as const,
  summary: (filters?: Record<string, string | undefined>) => [...analyticsKeys.all, "summary", filters] as const,
  project: (id: string) => [...analyticsKeys.all, "project", id] as const,
  department: (filters?: Record<string, string | undefined>) => [...analyticsKeys.all, "department", filters] as const,
  center: (filters?: Record<string, string | undefined>) => [...analyticsKeys.all, "center", filters] as const,
  period: (filters?: Record<string, string | undefined>) => [...analyticsKeys.all, "period", filters] as const,
  forecast: (filters?: Record<string, string | undefined>) => [...analyticsKeys.all, "forecast", filters] as const,
  contract: (filters?: Record<string, string | undefined>) => [...analyticsKeys.all, "contract", filters] as const,
  productService: (filters?: Record<string, string | undefined>) => [...analyticsKeys.all, "productService", filters] as const,
};

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function buildUrl(base: string, params?: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, v);
    }
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export function useRevenueSummary(filters?: { from?: string; to?: string; project_id?: string }) {
  return useQuery({
    queryKey: analyticsKeys.summary(filters as Record<string, string | undefined>),
    queryFn: () => apiFetch<RevenueSummary>(buildUrl("/api/revenue/summary", filters as Record<string, string | undefined>)),
    staleTime: 30_000,
  });
}

export function useRevenueByProject(projectId: string) {
  return useQuery({
    queryKey: analyticsKeys.project(projectId),
    queryFn: () => apiFetch<{
      project_id: string; total_confirmed: number; entry_count: number; avg_completion: number;
      entries: any[]; allocations: any[]; adjustments: any[];
    }>(`/api/revenue/by-project/${projectId}`),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useRevenueByDepartment(filters?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: analyticsKeys.department(filters as Record<string, string | undefined>),
    queryFn: () => apiFetch<Array<{
      dept_id: string; dept_name: string; dept_code: string; total_allocated: number; project_count: number;
    }>>(buildUrl("/api/revenue/by-department", filters as Record<string, string | undefined>)),
  });
}

export function useRevenueByCenter(filters?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: analyticsKeys.center(filters as Record<string, string | undefined>),
    queryFn: () => apiFetch<Array<{
      center_id: string; center_name: string; center_code: string; total_allocated: number; dept_count: number;
    }>>(buildUrl("/api/revenue/by-center", filters as Record<string, string | undefined>)),
  });
}

export function useRevenueByPeriod(filters?: { group_by?: string; from?: string; to?: string; project_id?: string }) {
  return useQuery({
    queryKey: analyticsKeys.period(filters as Record<string, string | undefined>),
    queryFn: () => apiFetch<Array<{ period: string; amount: number }>>(
      buildUrl("/api/revenue/by-period", filters as Record<string, string | undefined>)
    ),
  });
}

export function useRevenueForecast(filters?: { project_id?: string; months?: string }) {
  return useQuery({
    queryKey: analyticsKeys.forecast(filters as Record<string, string | undefined>),
    queryFn: () => apiFetch<RevenueForecast>(buildUrl("/api/revenue/forecast", filters as Record<string, string | undefined>)),
  });
}

export function useRevenueByContract(filters?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: analyticsKeys.contract(filters as Record<string, string | undefined>),
    queryFn: () => apiFetch<Array<{
      contract_id: string; contract_no: string; contract_title: string; total: number; entry_count: number;
    }>>(buildUrl("/api/revenue/by-contract", filters as Record<string, string | undefined>)),
  });
}

export function useRevenueByProductService(filters?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: analyticsKeys.productService(filters as Record<string, string | undefined>),
    queryFn: () => apiFetch<Array<{
      product_service_id: string; code: string; name: string; category: string; total: number; entry_count: number;
    }>>(buildUrl("/api/revenue/by-product-service", filters as Record<string, string | undefined>)),
  });
}
