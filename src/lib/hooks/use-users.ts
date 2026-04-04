// Hooks quản lý người dùng: danh sách, CRUD, đặt lại mật khẩu, mời, đăng xuất

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
  detail: (id: string) => [...userKeys.all, id] as const,
};

/** Lấy danh sách tất cả user qua API */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        console.error("[useUsers] API error:", err.error);
        throw new Error(err.error || "Failed to fetch users");
      }
      return res.json();
    },
  });
}

/** Lấy chi tiết 1 user kèm phòng ban */
export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*, department:departments!users_dept_id_fkey(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

/** Cập nhật thông tin user, tự chuyển chuỗi rỗng thành null cho FK */
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Record<string, any>) => {
      if (updates.dept_id === "") updates.dept_id = null;
      if (updates.custom_role_id === "") updates.custom_role_id = null;
      if (updates.manager_id === "") updates.manager_id = null;
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi cập nhật");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.list() }),
  });
}

/** Xóa tài khoản user */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi xóa tài khoản");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.list() }),
  });
}

/** Đặt lại mật khẩu user */
export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi đặt lại mật khẩu");
      return data;
    },
  });
}

/** Tạo tài khoản user mới */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: {
        email: string;
        password: string;
        full_name: string;
        role?: string;
        dept_id?: string;
        center_id?: string;
        team_id?: string;
        job_title?: string;
      }
    ) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tạo tài khoản");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.list() }),
  });
}

/** Gửi lời mời tham gia tổ chức qua email */
export function useInviteUser() {
  return useMutation({
    mutationFn: async (input: {
      email: string;
      role: string;
      dept_id?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user!.id)
        .single();

      const token = crypto.randomUUID();
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      const { data, error } = await supabase
        .from("user_invitations")
        .insert({
          org_id: profile!.org_id,
          email: input.email,
          role: input.role,
          dept_id: input.dept_id || null,
          invited_by: user!.id,
          token,
          expires_at: expires.toISOString(),
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Gửi email mời qua Edge Function
      await supabase.functions.invoke("send-notification", {
        body: {
          type: "invitation",
          email: input.email,
          token,
          org_id: profile!.org_id,
        },
      });

      return data;
    },
  });
}

/** Đăng xuất và chuyển về trang login */
export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = "/login";
    },
  });
}
