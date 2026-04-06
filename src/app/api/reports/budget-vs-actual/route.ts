import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse } from "@/lib/api/helpers";

// So sánh ngân sách dự kiến vs chi thực tế theo phòng ban hoặc dự án.
// Dùng cho báo cáo budget variance analysis.
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const admin = getUntypedAdmin();
  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group") || "dept";

  if (group === "dept") {
    // Tổng hợp theo phòng ban: budget từ dept_budget_allocations vs chi từ cost_entries
    const { data, error } = await admin.from("v_dept_fund_summary").select("*");
    if (error) return errorResponse(error.message, 500);

    const result = (data ?? []).map((d: any) => ({
      id: d.dept_id,
      name: d.dept_name,
      code: d.dept_code,
      budget: Number(d.expected_fund),
      actual: Number(d.actual_revenue) + Number(d.internal_rev),
      costs: Number(d.total_costs),
      variance: Number(d.expected_fund) - Number(d.actual_revenue) - Number(d.internal_rev),
      variance_pct: Number(d.expected_fund) > 0
        ? Math.round(((Number(d.actual_revenue) + Number(d.internal_rev)) / Number(d.expected_fund)) * 100)
        : 0,
    }));

    return jsonResponse(result);
  }

  // Tổng hợp theo dự án: contract_value vs cost_entries
  const { data, error } = await admin.from("v_contract_profitloss").select("*");
  if (error) return errorResponse(error.message, 500);

  const result = (data ?? []).map((c: any) => ({
    id: c.contract_id,
    name: c.contract_title,
    code: c.contract_no,
    project: c.project_code,
    budget: Number(c.contract_value),
    actual: Number(c.total_revenue),
    costs: Number(c.total_costs),
    profit: Number(c.profit),
    margin_pct: Number(c.margin_pct),
    revenue_pct: Number(c.revenue_pct),
  }));

  return jsonResponse(result);
}
