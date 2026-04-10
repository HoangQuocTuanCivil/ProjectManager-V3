"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const MODULE_ACCESS_KEY = ["module-access"] as const;
const MODULE_ACCESS_ALL_KEY = ["module-access", "all"] as const;

/** Danh sách module bị tắt cho user hiện tại (sidebar, page guard) */
export function useModuleAccess() {
  return useQuery({
    queryKey: MODULE_ACCESS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/module-access");
      if (!res.ok) throw new Error("Lỗi tải phân quyền module");
      const json = await res.json();
      return new Set<string>(json.disabledModules as string[]);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Toàn bộ cấu hình module access — dùng cho trang admin settings */
export function useModuleAccessAll() {
  return useQuery({
    queryKey: MODULE_ACCESS_ALL_KEY,
    queryFn: async () => {
      const res = await fetch("/api/module-access/all");
      if (!res.ok) throw new Error("Lỗi tải cấu hình module");
      const json = await res.json();
      return json.items as {
        id: string;
        module_key: string;
        target_type: "center" | "dept";
        target_id: string;
        is_enabled: boolean;
      }[];
    },
  });
}

/** Lưu cấu hình module access (admin) */
export function useSaveModuleAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { module_key: string; target_type: "center" | "dept"; target_id: string; is_enabled: boolean }[]) => {
      const res = await fetch("/api/module-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Lỗi lưu cấu hình");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MODULE_ACCESS_KEY });
      qc.invalidateQueries({ queryKey: MODULE_ACCESS_ALL_KEY });
    },
  });
}

/** 10 module keys tương ứng với nav sidebar */
export const ALL_MODULES = [
  { key: "overview", label: "Tổng quan" },
  { key: "tasks", label: "Công việc" },
  { key: "projects", label: "Dự án" },
  { key: "kpi", label: "KPI & Khoán" },
  { key: "contracts", label: "Hợp đồng" },
  { key: "revenue", label: "Doanh thu" },
  { key: "costs", label: "Chi phí" },
  { key: "goals", label: "Goals & OKR" },
  { key: "workflow", label: "Quy trình" },
  { key: "reports", label: "Báo cáo" },
] as const;
