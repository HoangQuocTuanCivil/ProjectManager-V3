import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, parsePagination } from "@/lib/api/helpers";

// Danh sách công nợ khoán âm — filter theo trạng thái và phòng ban
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const { from, to, page, per_page } = parsePagination(searchParams);

  let query = supabase
    .from("salary_deductions")
    .select(`
      *,
      user:users(id, full_name, email, dept_id),
      period:allocation_periods(id, name, period_start, period_end)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const status = searchParams.get("status");
  const user_id = searchParams.get("user_id");

  if (status && status !== "all") query = query.eq("status", status as any);
  if (user_id) query = query.eq("user_id", user_id);

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}
