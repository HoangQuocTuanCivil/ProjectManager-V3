import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const projectId = params.id;

  const [entriesRes, allocRes, adjRes] = await Promise.all([
    supabase
      .from("revenue_entries")
      .select("id, amount, status, dimension, source, recognition_date, description, completion_percentage")
      .eq("project_id", projectId)
      .order("recognition_date", { ascending: false }),

    supabase
      .from("dept_revenue_allocations")
      .select("id, dept_id, allocation_percentage, allocated_amount, department:departments(id, name, code)")
      .eq("project_id", projectId),

    supabase
      .from("revenue_adjustments")
      .select("id, old_amount, new_amount, adjustment_amount, reason, created_at, addendum:contract_addendums(id, addendum_no)")
      .in("contract_id", (
        await supabase.from("contracts").select("id").eq("project_id", projectId)
      ).data?.map(c => c.id) ?? []),
  ]);

  if (entriesRes.error) return errorResponse(entriesRes.error.message, 500);

  const entries = entriesRes.data ?? [];
  const confirmed = entries.filter(e => e.status === "confirmed");
  const total = confirmed.reduce((s, e) => s + Number(e.amount), 0);
  const avgCompletion = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + (e.completion_percentage ?? 0), 0) / entries.length * 100) / 100
    : 0;

  return jsonResponse({
    project_id: projectId,
    total_confirmed: total,
    entry_count: entries.length,
    avg_completion: avgCompletion,
    entries: entries,
    allocations: allocRes.data ?? [],
    adjustments: adjRes.data ?? [],
  });
}
