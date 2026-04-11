import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export interface WorkloadEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  total: number;
  pending: number;
  in_progress: number;
  review: number;
  overdue: number;
  completed: number;
}

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("assignee_id, status, assignee:users!tasks_assignee_id_fkey(id, full_name, avatar_url, role)")
    .eq("org_id", profile.org_id)
    .is("deleted_at" as any, null)
    .neq("status", "cancelled")
    .not("assignee_id", "is", null);

  if (error) return errorResponse(error.message, 500);

  const map = new Map<string, WorkloadEntry>();

  for (const t of tasks ?? []) {
    if (!t.assignee_id) continue;
    let entry = map.get(t.assignee_id);
    if (!entry) {
      const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee;
      entry = {
        user_id: t.assignee_id,
        full_name: assignee?.full_name ?? "",
        avatar_url: assignee?.avatar_url ?? null,
        role: assignee?.role ?? "staff",
        total: 0,
        pending: 0,
        in_progress: 0,
        review: 0,
        overdue: 0,
        completed: 0,
      };
      map.set(t.assignee_id, entry);
    }
    entry.total++;
    const status = t.status as string;
    if (status in entry) (entry as any)[status]++;
  }

  const data = Array.from(map.values()).sort((a, b) => b.total - a.total);

  return jsonResponse({ data });
}
