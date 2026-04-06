import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

type GroupBy = "month" | "quarter" | "year";

function truncDate(date: string, groupBy: GroupBy): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth();

  switch (groupBy) {
    case "year":
      return `${y}`;
    case "quarter":
      return `${y}-Q${Math.floor(m / 3) + 1}`;
    case "month":
    default:
      return `${y}-${String(m + 1).padStart(2, "0")}`;
  }
}

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const groupBy = (searchParams.get("group_by") || "month") as GroupBy;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const project_id = searchParams.get("project_id");

  let query = supabase
    .from("revenue_entries")
    .select("amount, status, recognition_date")
    .eq("status", "confirmed")
    .order("recognition_date", { ascending: true });

  if (from) query = query.gte("recognition_date", from);
  if (to) query = query.lte("recognition_date", to);
  if (project_id) query = query.eq("project_id", project_id);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  const periodMap = new Map<string, number>();
  for (const e of data ?? []) {
    const key = truncDate(e.recognition_date, groupBy);
    periodMap.set(key, (periodMap.get(key) || 0) + Number(e.amount));
  }

  const periods = Array.from(periodMap.entries())
    .map(([period, amount]) => ({ period, amount }))
    .sort((a, b) => a.period.localeCompare(b.period));

  // Tính thay đổi so với kỳ trước: MoM/QoQ/YoY
  const result = periods.map((cur, i) => {
    const prev = i > 0 ? periods[i - 1].amount : 0;
    const change = prev > 0 ? Math.round(((cur.amount - prev) / prev) * 10000) / 100 : null;
    return { ...cur, prev_amount: i > 0 ? prev : null, change_pct: change };
  });

  return jsonResponse(result);
}
