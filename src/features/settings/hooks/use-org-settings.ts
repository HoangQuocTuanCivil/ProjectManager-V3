// Hooks cài đặt tổ chức: cấu hình org, quyền hạn, vai trò tùy chỉnh

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/types/database";

const supabase = createClient();

export const settingsKeys = {
  all: ["settings"] as const,
  org: (category?: string) => [...settingsKeys.all, "org", category] as const,
  permissions: () => [...settingsKeys.all, "permissions"] as const,
  roles: () => [...settingsKeys.all, "roles"] as const,
};

/** Lấy cài đặt tổ chức, có thể lọc theo category */
export function useOrgSettings(category?: string) {
  return useQuery({
    queryKey: settingsKeys.org(category),
    queryFn: async () => {
      let query = supabase.from("org_settings").select("*");
      if (category) query = query.eq("category", category);
      const { data, error } = await query.order("key");
      if (error) throw error;
      return data;
    },
  });
}

/** Cập nhật hoặc tạo mới 1 cài đặt (upsert) */
export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      category,
      key,
      value,
    }: {
      category: string;
      key: string;
      value: Json;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user!.id)
        .single();

      const { error } = await supabase.from("org_settings").upsert(
        {
          org_id: profile!.org_id,
          category,
          key,
          value,
          updated_by: user!.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,category,key" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

/** Lấy danh sách quyền hạn hệ thống */
export function usePermissions() {
  return useQuery({
    queryKey: settingsKeys.permissions(),
    queryFn: async () => {
      const res = await fetch("/api/roles");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to fetch permissions");
      }
      const data = await res.json();
      return data.permissions || [];
    },
  });
}

/** Lấy danh sách vai trò tùy chỉnh */
export function useCustomRoles() {
  return useQuery({
    queryKey: settingsKeys.roles(),
    queryFn: async () => {
      const res = await fetch("/api/roles");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to fetch roles");
      }
      const data = await res.json();
      return data.roles || [];
    },
  });
}

/** Tạo vai trò tùy chỉnh mới */
export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      base_role: string;
      color?: string;
      permission_ids: string[];
    }) => {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tạo vai trò");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.roles() });
      qc.invalidateQueries({ queryKey: settingsKeys.permissions() });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      description?: string;
      base_role: string;
      color?: string;
      permission_ids: string[];
    }) => {
      const { id, ...body } = input;
      const res = await fetch(`/api/roles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi cập nhật vai trò");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.roles() });
      qc.invalidateQueries({ queryKey: settingsKeys.permissions() });
      qc.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi xóa vai trò");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.roles() });
      qc.invalidateQueries({ queryKey: settingsKeys.permissions() });
      qc.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}
