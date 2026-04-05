import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  const months = Math.min(24, Math.max(1, parseInt(searchParams.get("months") || "6")));

  const today = new Date().toISOString().split("T")[0];

  let confirmedQuery = supabase
    .from("revenue_entries")
    .select("amount")
    .eq("status", "confirmed");

  let pendingQuery = supabase
    .from("revenue_entries")
    .select("amount")
    .eq("status", "draft");

  if (project_id) {
    confirmedQuery = confirmedQuery.eq("project_id", project_id);
    pendingQuery = pendingQuery.eq("project_id", project_id);
  }

  let milestoneQuery = supabase
    .from("billing_milestones")
    .select("amount, due_date, status, contract:contracts(project_id)")
    .in("status", ["upcoming", "invoiced"])
    .gte("due_date", today)
    .order("due_date", { ascending: true });

  const [confirmedRes, pendingRes, milestoneRes] = await Promise.all([
    confirmedQuery,
    pendingQuery,
    milestoneQuery,
  ]);

  const totalConfirmed = (confirmedRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const totalPending = (pendingRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const milestones = (milestoneRes.data ?? []).filter(m => {
    if (!project_id) return true;
    const contract = m.contract as any;
    return contract?.project_id === project_id;
  });

  const periodMap = new Map<string, { projected: number; count: number }>();
  for (const m of milestones) {
    if (!m.due_date) continue;
    const key = m.due_date.substring(0, 7);
    const entry = periodMap.get(key) || { projected: 0, count: 0 };
    entry.projected += Number(m.amount);
    entry.count += 1;
    periodMap.set(key, entry);
  }

  const now = new Date();
  const periods: Array<{ period: string; projected_amount: number; milestone_count: number }> = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = periodMap.get(key);
    periods.push({
      period: key,
      projected_amount: entry?.projected ?? 0,
      milestone_count: entry?.count ?? 0,
    });
  }

  return jsonResponse({
    total_confirmed: totalConfirmed,
    total_pending: totalPending,
    projected_from_milestones: milestones.reduce((s, m) => s + Number(m.amount), 0),
    periods,
  });
}
