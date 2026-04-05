import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const project_id = searchParams.get("project_id");

  let query = supabase
    .from("revenue_entries")
    .select("amount, dimension, method, source, status, recognition_date");

  if (from) query = query.gte("recognition_date", from);
  if (to) query = query.lte("recognition_date", to);
  if (project_id) query = query.eq("project_id", project_id);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  const entries = data ?? [];
  const confirmed = entries.filter(e => e.status === "confirmed");

  const total = confirmed.reduce((s, e) => s + Number(e.amount), 0);
  const draft = entries.filter(e => e.status === "draft").reduce((s, e) => s + Number(e.amount), 0);

  const byDimension: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const e of confirmed) {
    const amt = Number(e.amount);
    byDimension[e.dimension] = (byDimension[e.dimension] || 0) + amt;
    byMethod[e.method] = (byMethod[e.method] || 0) + amt;
    bySource[e.source] = (bySource[e.source] || 0) + amt;
  }

  let growthRate: number | null = null;
  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const spanMs = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - spanMs).toISOString().split("T")[0];

    let prevQuery = supabase
      .from("revenue_entries")
      .select("amount")
      .eq("status", "confirmed")
      .gte("recognition_date", prevFrom)
      .lt("recognition_date", from);

    if (project_id) prevQuery = prevQuery.eq("project_id", project_id);

    const { data: prev } = await prevQuery;
    const prevTotal = (prev ?? []).reduce((s, e) => s + Number(e.amount), 0);

    if (prevTotal > 0) {
      growthRate = Math.round(((total - prevTotal) / prevTotal) * 10000) / 100;
    }
  }

  return jsonResponse({ total, draft, byDimension, byMethod, bySource, growthRate });
}
