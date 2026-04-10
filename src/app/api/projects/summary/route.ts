import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

interface ProjectSummary {
  project_id: string;
  contract_count: number;
  outgoing_budget: number;
  incoming_fund: number;
  task_count: number;
  overdue_count: number;
}

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();

  const [contractsRes, tasksRes] = await Promise.all([
    supabase
      .from("contracts")
      .select("project_id, contract_type, contract_value")
      .is("deleted_at", null)
      .in("status", ["active", "completed"]),
    supabase
      .from("tasks")
      .select("project_id, status")
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .not("project_id", "is", null),
  ]);

  const summaryMap = new Map<string, ProjectSummary>();

  const ensure = (pid: string): ProjectSummary => {
    let s = summaryMap.get(pid);
    if (!s) {
      s = { project_id: pid, contract_count: 0, outgoing_budget: 0, incoming_fund: 0, task_count: 0, overdue_count: 0 };
      summaryMap.set(pid, s);
    }
    return s;
  };

  for (const c of contractsRes.data ?? []) {
    const s = ensure(c.project_id);
    s.contract_count++;
    const val = Number(c.contract_value);
    if (c.contract_type === "outgoing") s.outgoing_budget += val;
    else s.incoming_fund += val;
  }

  for (const t of tasksRes.data ?? []) {
    if (!t.project_id) continue;
    const s = ensure(t.project_id);
    s.task_count++;
    if (t.status === "overdue") s.overdue_count++;
  }

  return jsonResponse({ data: Array.from(summaryMap.values()) });
}
