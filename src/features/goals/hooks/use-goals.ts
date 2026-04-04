// Hooks mục tiêu & OKR: danh sách dạng cây, tạo mục tiêu

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Goal, GoalCreateInput } from "@/lib/types";
import type { TablesInsert } from "@/lib/types/database";

const supabase = createClient();

export const goalKeys = {
  all: ["goals"] as const,
  list: () => [...goalKeys.all, "list"] as const,
  detail: (id: string) => [...goalKeys.all, id] as const,
};

/** Lấy tất cả mục tiêu, build cây cha-con, kèm owner và targets */
export function useGoals() {
  return useQuery({
    queryKey: goalKeys.list(),
    queryFn: async () => {
      const { data: allGoals, error } = await supabase
        .from("goals")
        .select("*")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!allGoals || allGoals.length === 0) return { tree: [], all: [] };

      const goalIds = allGoals.map((g) => g.id);
      const ownerIds = [
        ...new Set(
          allGoals.map((g) => g.owner_id).filter(Boolean) as string[]
        ),
      ];

      // Lấy song song owner và targets
      const [owners, targets] = await Promise.all([
        ownerIds.length > 0
          ? supabase
              .from("users")
              .select("id, full_name, avatar_url, role")
              .in("id", ownerIds)
          : { data: [] as { id: string; full_name: string; avatar_url: string | null; role: string }[] },
        supabase.from("goal_targets").select("*").in("goal_id", goalIds),
      ]);

      // Gắn owner và targets vào từng goal
      const enriched = allGoals.map((g) => ({
        ...g,
        owner:
          (owners.data || []).find((u) => u.id === g.owner_id) || null,
        targets:
          (targets.data || []).filter((t) => t.goal_id === g.id) || [],
        sub_goals: [] as Goal[],
      }));

      // Build cây: gắn con vào cha
      const goalMap = new Map(enriched.map((g) => [g.id, g]));
      const roots: typeof enriched = [];
      for (const g of enriched) {
        if (g.parent_goal_id && goalMap.has(g.parent_goal_id)) {
          goalMap.get(g.parent_goal_id)!.sub_goals.push(g as unknown as Goal);
        } else {
          roots.push(g);
        }
      }

      return { tree: roots, all: enriched };
    },
  });
}

/** Tạo mục tiêu mới, tự gắn org_id và owner */
export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GoalCreateInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user!.id)
        .single();
      const { data, error } = await supabase
        .from("goals")
        .insert({
          ...input,
          org_id: profile!.org_id,
          owner_id: user!.id,
        } as TablesInsert<'goals'>)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.list() });
      qc.invalidateQueries({ queryKey: ["goals", "all-for-parent"] });
    },
  });
}
