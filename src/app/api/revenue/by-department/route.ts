import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("dept_revenue_allocations")
    .select("dept_id, allocated_amount, project_id, department:departments(id, name, code), revenue_entry:revenue_entries(recognition_date, status)");

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  const filtered = (data ?? []).filter(row => {
    const entry = row.revenue_entry as any;
    if (!entry || entry.status !== "confirmed") return false;
    if (from && entry.recognition_date < from) return false;
    if (to && entry.recognition_date > to) return false;
    return true;
  });

  const deptMap = new Map<string, { dept_id: string; dept_name: string; dept_code: string; total_allocated: number; project_count: Set<string> }>();

  for (const row of filtered) {
    const dept = row.department as any;
    if (!dept) continue;

    let entry = deptMap.get(row.dept_id);
    if (!entry) {
      entry = { dept_id: row.dept_id, dept_name: dept.name, dept_code: dept.code, total_allocated: 0, project_count: new Set() };
      deptMap.set(row.dept_id, entry);
    }
    entry.total_allocated += Number(row.allocated_amount);
    if (row.project_id) entry.project_count.add(row.project_id);
  }

  const result = Array.from(deptMap.values())
    .map(d => ({ dept_id: d.dept_id, dept_name: d.dept_name, dept_code: d.dept_code, total_allocated: d.total_allocated, project_count: d.project_count.size }))
    .sort((a, b) => b.total_allocated - a.total_allocated);

  return jsonResponse(result);
}
