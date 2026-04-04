// Hooks quản lý tổ chức: trung tâm (center), nhóm (team)

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { userKeys } from "./use-users";
import type { Team, CenterUpdateInput, TeamUpdateInput } from "@/lib/types";

const supabase = createClient();

// ─── Trung tâm (Center) ─────────────────────────────────────────────

export const centerKeys = {
  all: ["centers"] as const,
  list: () => [...centerKeys.all, "list"] as const,
  detail: (id: string) => [...centerKeys.all, id] as const,
};

/** Lấy danh sách trung tâm */
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

/** Tạo trung tâm mới */
export function useCreateCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      code?: string;
      description?: string;
      director_id?: string;
    }) => {
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
    },
  });
}

/** Cập nhật trung tâm */
export function useUpdateCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & CenterUpdateInput) => {
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
    },
  });
}

// ─── Nhóm (Team) ────────────────────────────────────────────────────

export const teamKeys = {
  all: ["teams"] as const,
  list: (deptId?: string) => [...teamKeys.all, "list", deptId] as const,
  detail: (id: string) => [...teamKeys.all, id] as const,
};

/** Lấy danh sách nhóm theo phòng ban, kèm thông tin trưởng nhóm */
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

      // Lấy thông tin trưởng nhóm riêng để tránh lỗi FK naming
      const leaderIds = [
        ...new Set(data.map((t) => t.leader_id).filter((id): id is string => id != null)),
      ];
      let leaders: Array<{ id: string; full_name: string; avatar_url: string | null; role: string; email: string }> = [];
      if (leaderIds.length > 0) {
        const { data: leaderData } = await supabase
          .from("users")
          .select("id, full_name, avatar_url, role, email")
          .in("id", leaderIds);
        leaders = leaderData || [];
      }

      return data.map((t) => ({
        ...t,
        leader: leaders.find((u) => u.id === t.leader_id) || null,
      })) as unknown as Team[];
    },
  });
}

/** Lấy tất cả nhóm (kể cả inactive), kèm trưởng nhóm và phòng ban */
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

      const leaderIds = [
        ...new Set(data.map((t) => t.leader_id).filter((id): id is string => id != null)),
      ];
      const deptIds = [
        ...new Set(data.map((t) => t.dept_id).filter((id): id is string => id != null)),
      ];

      const [leadersRes, deptsRes] = await Promise.all([
        leaderIds.length > 0
          ? supabase
              .from("users")
              .select("id, full_name, avatar_url, role, email")
              .in("id", leaderIds)
          : { data: [] as { id: string; full_name: string; avatar_url: string | null; role: string; email: string }[] },
        deptIds.length > 0
          ? supabase
              .from("departments")
              .select("id, name, code")
              .in("id", deptIds)
          : { data: [] as { id: string; name: string; code: string }[] },
      ]);

      return data.map((t) => ({
        ...t,
        leader:
          (leadersRes.data || []).find((u) => u.id === t.leader_id) ||
          null,
        department:
          (deptsRes.data || []).find((d) => d.id === t.dept_id) || null,
      })) as unknown as Team[];
    },
  });
}

/** Tạo nhóm mới trong phòng ban */
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      code?: string;
      description?: string;
      dept_id: string;
      leader_id?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user!.id)
        .single();
      const { data, error } = await supabase
        .from("teams")
        .insert({
          ...input,
          org_id: profile!.org_id,
          leader_id: input.leader_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}

/** Cập nhật thông tin nhóm */
export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & TeamUpdateInput) => {
      if (updates.leader_id === "") updates.leader_id = null;
      const { data, error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}

/** Xóa nhóm, gỡ team_id khỏi các user thuộc nhóm trước */
export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("users").update({ team_id: null }).eq("team_id", id);
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      qc.invalidateQueries({ queryKey: userKeys.list() });
    },
  });
}
