import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse, parsePagination } from "@/lib/api/helpers";
import { hasMinRole } from "@/lib/utils/permissions";
import type { UserRole } from "@/lib/types";

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
  if (outcome && outcome !== "all") {
    if (!["bonus", "deduction", "balanced"].includes(outcome)) return errorResponse("outcome không hợp lệ", 400);
    query = query.eq("outcome", outcome);
  }

  if (!hasMinRole(profile.role as UserRole, "director")) {
    query = query.eq("dept_id", profile.dept_id);
  } else if (dept_id) {
    query = query.eq("dept_id", dept_id);
  }

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}
