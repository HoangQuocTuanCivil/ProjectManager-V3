import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const { data: allocations, error } = await supabase
    .from("dept_revenue_allocations")
    .select("dept_id, allocated_amount, department:departments(id, name, code, center_id), revenue_entry:revenue_entries(recognition_date, status)");

  if (error) return errorResponse(error.message, 500);

  const { data: centers } = await supabase
    .from("centers")
    .select("id, name, code")
    .eq("is_active", true)
    .order("sort_order");

  const centerMap = new Map((centers ?? []).map(c => [c.id, c]));

  const filtered = (allocations ?? []).filter(row => {
    const entry = row.revenue_entry as any;
    if (!entry || entry.status !== "confirmed") return false;
    if (from && entry.recognition_date < from) return false;
    if (to && entry.recognition_date > to) return false;
    return true;
  });

  const aggMap = new Map<string, { center_id: string; center_name: string; center_code: string; total_allocated: number; dept_count: Set<string> }>();

  for (const row of filtered) {
    const dept = row.department as any;
    if (!dept?.center_id) continue;

    const center = centerMap.get(dept.center_id);
    if (!center) continue;

    let entry = aggMap.get(dept.center_id);
    if (!entry) {
      entry = { center_id: dept.center_id, center_name: center.name, center_code: center.code ?? "", total_allocated: 0, dept_count: new Set() };
      aggMap.set(dept.center_id, entry);
    }
    entry.total_allocated += Number(row.allocated_amount);
    entry.dept_count.add(row.dept_id);
  }

  const result = Array.from(aggMap.values())
    .map(c => ({ center_id: c.center_id, center_name: c.center_name, center_code: c.center_code, total_allocated: c.total_allocated, dept_count: c.dept_count.size }))
    .sort((a, b) => b.total_allocated - a.total_allocated);

  return jsonResponse(result);
}
