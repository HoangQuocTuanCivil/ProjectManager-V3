import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse, parsePagination } from "@/lib/api/helpers";

// Bảng thưởng/nợ cá nhân — dữ liệu từ view v_employee_bonus
// Filter theo đợt khoán, phòng ban, loại kết quả (bonus/deduction/balanced)
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const admin = getUntypedAdmin();
  const { searchParams } = new URL(req.url);
  const { from, to, page, per_page } = parsePagination(searchParams);

  let query = admin
    .from("v_employee_bonus")
    .select("*", { count: "exact" })
    .order("bonus_amount", { ascending: false })
    .range(from, to);

  const period_id = searchParams.get("period_id");
  const dept_id = searchParams.get("dept_id");
  const outcome = searchParams.get("outcome");

  if (period_id) query = query.eq("period_id", period_id);
  if (dept_id) query = query.eq("dept_id", dept_id);
  if (outcome && outcome !== "all") {
    if (!["bonus", "deduction", "balanced"].includes(outcome)) return errorResponse("outcome không hợp lệ", 400);
    query = query.eq("outcome", outcome);
  }

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}
