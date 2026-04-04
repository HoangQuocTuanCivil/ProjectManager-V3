
// use-kpi.ts - KPI records, allocation, evaluation hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { AllocationPeriod, AllocationResult, AllocationConfig, Team } from "@/lib/types";

const supabase = createClient();

export const kpiKeys = {
  all: ["kpi"] as const,
  records: (userId?: string) => [...kpiKeys.all, "records", userId] as const,
  allocation: () => [...kpiKeys.all, "allocation"] as const,
  periods: () => [...kpiKeys.all, "periods"] as const,
  period: (id: string) => [...kpiKeys.all, "period", id] as const,
  config: () => [...kpiKeys.all, "config"] as const,
};

export function useKPIRecords(userId?: string) {
  return useQuery({
    queryKey: kpiKeys.records(userId),
    queryFn: async () => {
      let query = supabase.from("kpi_records").select("*").order("period_start", { ascending: false }).limit(20);
      if (userId) query = query.eq("user_id", userId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useAllocationConfig() {
  return useQuery({
    queryKey: kpiKeys.config(),
    queryFn: async () => {
      const { data, error } = await supabase.from("allocation_configs").select("*").eq("is_active", true).single();
      if (error) throw error;
      return data as AllocationConfig;
    },
  });
}

export function useAllocationPeriods() {
  return useQuery({
    queryKey: kpiKeys.periods(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allocation_periods")
        .select("*, config:allocation_configs(*), project:projects(code, name), results:allocation_results(*, user:users(id, full_name, avatar_url, role))")
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as AllocationPeriod[];
    },
  });
}

export function useCreateAllocationPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<AllocationPeriod>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
      if (!profile) throw new Error("Không tìm thấy profile");

      // Get or create default config
      let { data: config } = await supabase.from("allocation_configs").select("id").eq("org_id", profile.org_id).eq("is_active", true).single();
      if (!config) {
        const { data: newConfig, error: cfgErr } = await supabase.from("allocation_configs").insert({
          org_id: profile.org_id, name: "Cấu hình mặc định",
          weight_volume: 0.4, weight_quality: 0.3, weight_difficulty: 0.2, weight_ahead: 0.1,
        }).select("id").single();
        if (cfgErr) throw new Error("Vui lòng tạo cấu hình KPI trước (tab Cấu hình)");
        config = newConfig;
      }

      const { data, error } = await supabase
        .from("allocation_periods")
        .insert({ ...input, org_id: profile.org_id, config_id: config!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.periods() }),
  });
}

export function useCalculateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ periodId, useActual = true }: { periodId: string; useActual?: boolean }) => {
      const { data, error } = await supabase.rpc("fn_allocate_smart", { p_period_id: periodId, p_use_actual: useActual });
      if (error) throw error;
      // Check for error in returned JSONB
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: kpiKeys.periods() });
      const count = data?.user_count ?? 0;
      if (count > 0) {
        toast.success(`Đã tính khoán cho ${count} nhân viên`);
      } else {
        toast.warning("Không tìm thấy task hoàn thành trong kỳ. Kiểm tra lại ngày bắt đầu/kết thúc và trạng thái task.");
      }
    },
    onError: (e: any) => toast.error(e.message || "Lỗi tính khoán"),
  });
}

export function useApproveAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("allocation_periods")
        .update({ status: "approved", approved_by: user!.id, approved_at: new Date().toISOString() })
        .eq("id", periodId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.periods() }),
  });
}

export function useDeleteAllocationPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      // Delete results first, then period
      await supabase.from("allocation_results").delete().eq("period_id", periodId);
      const { error } = await supabase.from("allocation_periods").delete().eq("id", periodId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kpiKeys.periods() });
      toast.success("Đã xóa đợt khoán");
    },
    onError: (e: any) => toast.error(e.message || "Lỗi xóa đợt khoán"),
  });
}


// use-centers.ts - Center (Trung tâm) management hooks


export const centerKeys = {
  all: ["centers"] as const,
  list: () => [...centerKeys.all, "list"] as const,
  detail: (id: string) => [...centerKeys.all, id] as const,
};

export function useCenters() {
  return useQuery({
    queryKey: centerKeys.list(),
    queryFn: async () => {
      const res = await fetch("/api/centers");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to fetch centers");
      }
      return res.json();
    },
  });
}

export function useCreateCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; code?: string; description?: string; director_id?: string }) => {
      const res = await fetch("/api/centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tạo trung tâm");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: centerKeys.all });
      toast.success("Đã tạo trung tâm");
    },
    onError: (e: any) => toast.error(e.message || "Lỗi tạo trung tâm"),
  });
}

export function useUpdateCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      if (updates.director_id === "") updates.director_id = null;
      const res = await fetch(`/api/centers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi cập nhật trung tâm");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: centerKeys.all });
      toast.success("Đã cập nhật trung tâm");
    },
    onError: (e: any) => toast.error(e.message || "Lỗi cập nhật trung tâm"),
  });
}


// use-teams.ts - Team management hooks


export const teamKeys = {
  all: ["teams"] as const,
  list: (deptId?: string) => [...teamKeys.all, "list", deptId] as const,
  detail: (id: string) => [...teamKeys.all, id] as const,
};

export function useTeams(deptId?: string) {
  return useQuery({
    queryKey: teamKeys.list(deptId),
    queryFn: async () => {
      let query = supabase
        .from("teams")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (deptId) query = query.eq("dept_id", deptId);
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [] as Team[];

      // Fetch leaders separately to avoid FK naming issues
      const leaderIds = [...new Set(data.map((t: any) => t.leader_id).filter(Boolean))];
      let leaders: any[] = [];
      if (leaderIds.length > 0) {
        const { data: leaderData } = await supabase
          .from("users")
          .select("id, full_name, avatar_url, role, email")
          .in("id", leaderIds);
        leaders = leaderData || [];
      }

      return data.map((t: any) => ({
        ...t,
        leader: leaders.find((u: any) => u.id === t.leader_id) || null,
      })) as Team[];
    },
  });
}

export function useAllTeams() {
  return useQuery({
    queryKey: [...teamKeys.all, "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      if (!data || data.length === 0) return [] as Team[];

      const leaderIds = [...new Set(data.map((t: any) => t.leader_id).filter(Boolean))];
      const deptIds = [...new Set(data.map((t: any) => t.dept_id).filter(Boolean))];

      const [leadersRes, deptsRes] = await Promise.all([
        leaderIds.length > 0
          ? supabase.from("users").select("id, full_name, avatar_url, role, email").in("id", leaderIds)
          : { data: [] },
        deptIds.length > 0
          ? supabase.from("departments").select("id, name, code").in("id", deptIds)
          : { data: [] },
      ]);

      return data.map((t: any) => ({
        ...t,
        leader: (leadersRes.data || []).find((u: any) => u.id === t.leader_id) || null,
        department: (deptsRes.data || []).find((d: any) => d.id === t.dept_id) || null,
      })) as Team[];
    },
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; code?: string; description?: string; dept_id: string; leader_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
      const { data, error } = await supabase.from("teams").insert({
        ...input,
        org_id: profile!.org_id,
        leader_id: input.leader_id || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      toast.success("Đã tạo nhóm");
    },
    onError: (e: any) => toast.error(e.message || "Lỗi tạo nhóm"),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      if (updates.leader_id === "") updates.leader_id = null;
      const { data, error } = await supabase.from("teams").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      toast.success("Đã cập nhật nhóm");
    },
    onError: (e: any) => toast.error(e.message || "Lỗi cập nhật nhóm"),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Xóa team_id khỏi users trước
      await supabase.from("users").update({ team_id: null }).eq("team_id", id);
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      qc.invalidateQueries({ queryKey: userKeys.list() });
      toast.success("Đã xóa nhóm");
    },
    onError: (e: any) => toast.error(e.message || "Lỗi xóa nhóm"),
  });
}


// use-users.ts - User management hooks


export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
  detail: (id: string) => [...userKeys.all, id] as const,
};

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

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*, department:departments!users_dept_id_fkey(*)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      // Clean empty strings to null for UUID FK columns
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

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string; full_name: string; role?: string; dept_id?: string; center_id?: string; team_id?: string; job_title?: string }) => {
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

export function useInviteUser() {
  return useMutation({
    mutationFn: async (input: { email: string; role: string; dept_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();

      const token = crypto.randomUUID();
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      const { data, error } = await supabase.from("user_invitations").insert({
        org_id: profile!.org_id,
        email: input.email,
        role: input.role,
        dept_id: input.dept_id || null,
        invited_by: user!.id,
        token,
        expires_at: expires.toISOString(),
      }).select().single();
      if (error) throw error;

      // Send invitation email via Edge Function
      await supabase.functions.invoke("send-notification", {
        body: { type: "invitation", email: input.email, token, org_id: profile!.org_id },
      });

      return data;
    },
  });
}


// use-notifications.ts - Notification hooks


export const notifKeys = {
  all: ["notifications"] as const,
  list: () => [...notifKeys.all, "list"] as const,
  unread: () => [...notifKeys.all, "unread"] as const,
};

export function useNotifications() {
  return useQuery({
    queryKey: notifKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notifKeys.unread(),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.list() });
      qc.invalidateQueries({ queryKey: notifKeys.unread() });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.list() });
      qc.invalidateQueries({ queryKey: notifKeys.unread() });
    },
  });
}


// use-goals.ts - Goals & OKR hooks


export const goalKeys = {
  all: ["goals"] as const,
  list: () => [...goalKeys.all, "list"] as const,
  detail: (id: string) => [...goalKeys.all, id] as const,
};

export function useGoals() {
  return useQuery({
    queryKey: goalKeys.list(),
    queryFn: async () => {
      // Fetch ALL goals (not just top-level) excluding cancelled
      const { data: allGoals, error } = await supabase
        .from("goals")
        .select("*")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!allGoals || allGoals.length === 0) return { tree: [], all: [] };

      // Fetch owners and targets for all goals
      const goalIds = allGoals.map((g) => g.id);
      const ownerIds = [...new Set(allGoals.map((g) => g.owner_id).filter(Boolean))];
      const [owners, targets] = await Promise.all([
        ownerIds.length > 0
          ? supabase.from("users").select("id, full_name, avatar_url, role").in("id", ownerIds)
          : { data: [] },
        supabase.from("goal_targets").select("*").in("goal_id", goalIds),
      ]);

      // Enrich goals with owner and targets
      const enriched = allGoals.map((g) => ({
        ...g,
        owner: owners.data?.find((u: any) => u.id === g.owner_id) || null,
        targets: targets.data?.filter((t: any) => t.goal_id === g.id) || [],
        sub_goals: [] as any[],
      }));

      // Build tree: attach children to parents
      const goalMap = new Map(enriched.map((g) => [g.id, g]));
      const roots: any[] = [];
      for (const g of enriched) {
        if (g.parent_goal_id && goalMap.has(g.parent_goal_id)) {
          goalMap.get(g.parent_goal_id)!.sub_goals.push(g);
        } else {
          roots.push(g);
        }
      }

      return { tree: roots, all: enriched };
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, any>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
      const { data, error } = await supabase.from("goals").insert({ ...input, org_id: profile!.org_id, owner_id: user!.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.list() });
      qc.invalidateQueries({ queryKey: ["goals", "all-for-parent"] });
    },
  });
}


// use-settings.ts - Org settings hooks


export const settingsKeys = {
  all: ["settings"] as const,
  org: (category?: string) => [...settingsKeys.all, "org", category] as const,
  permissions: () => [...settingsKeys.all, "permissions"] as const,
  roles: () => [...settingsKeys.all, "roles"] as const,
};

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

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ category, key, value }: { category: string; key: string; value: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();

      const { error } = await supabase
        .from("org_settings")
        .upsert({
          org_id: profile!.org_id,
          category,
          key,
          value: JSON.stringify(value),
          updated_by: user!.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "org_id,category,key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

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

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; base_role: string; color?: string; permission_ids: string[] }) => {
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
    mutationFn: async (input: { id: string; name: string; description?: string; base_role: string; color?: string; permission_ids: string[] }) => {
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
    },
  });
}


// use-auth.ts - Auth hooks


export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = "/login";
    },
  });
}
