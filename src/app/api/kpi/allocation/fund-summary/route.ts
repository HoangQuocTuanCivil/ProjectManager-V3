import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "director");
  if (roleErr) return errorResponse(roleErr, 403);

  const admin = getUntypedAdmin();
  const { searchParams } = new URL(req.url);
  const dept_id = searchParams.get("dept_id");
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  const hasDateFilter = !!(start_date || end_date);

  /* Không lọc ngày → dùng view tổng hợp sẵn (nhanh hơn) */
  if (!hasDateFilter) {
    let query = admin.from("v_dept_fund_summary").select("*");
    if (dept_id) query = query.eq("dept_id", dept_id);
    const { data, error } = await query;
    if (error) return errorResponse(error.message, 500);
    return jsonResponse(data);
  }

  /* Có lọc ngày → query từng thành phần riêng rồi gộp */
  const [deptRes, revenueRes, costsRes, internalRes, salaryRes, expectedRes] = await Promise.all([
    /* Danh sách PB active */
    (() => {
      let q = admin.from("departments").select("id, org_id, name, code").eq("is_active", true);
      if (dept_id) q = q.eq("id", dept_id);
      return q;
    })(),

    /* Doanh thu thực tế: phân bổ doanh thu theo PB, lọc theo ngày ghi nhận */
    (() => {
      let q = admin.from("dept_revenue_allocations").select("dept_id, allocated_amount, revenue_entry:revenue_entries!inner(status, recognition_date)");
      if (start_date) q = q.gte("revenue_entry.recognition_date", start_date);
      if (end_date) q = q.lte("revenue_entry.recognition_date", end_date);
      return q;
    })(),

    /* Chi phí: lọc theo period_start hoặc created_at */
    (() => {
      let q = admin.from("cost_entries").select("dept_id, amount, period_start").not("dept_id", "is", null);
      if (start_date) q = q.gte("period_start", start_date);
      if (end_date) q = q.lte("period_start", end_date);
      return q;
    })(),

    /* Doanh thu nội bộ */
    (() => {
      let q = admin.from("internal_revenue").select("dept_id, total_amount, created_at").eq("status", "approved");
      if (start_date) q = q.gte("created_at", start_date);
      if (end_date) q = q.lte("created_at", end_date);
      return q;
    })(),

    /* Lương: lọc theo tháng */
    (() => {
      let q = admin.from("salary_records").select("dept_id, base_salary, month").not("dept_id", "is", null);
      if (start_date) q = q.gte("month", start_date);
      if (end_date) q = q.lte("month", end_date);
      return q;
    })(),

    /* Quỹ dự kiến từ view (không phụ thuộc ngày) */
    admin.from("v_expected_fund").select("dept_id, expected_fund"),
  ]);

  if (deptRes.error) return errorResponse(deptRes.error.message, 500);

  /* Gộp doanh thu theo PB — chỉ lấy HĐ confirmed */
  const revMap = new Map<string, number>();
  for (const r of (revenueRes.data || [])) {
    const re = r.revenue_entry as any;
    if (re?.status !== "confirmed") continue;
    revMap.set(r.dept_id, (revMap.get(r.dept_id) || 0) + Number(r.allocated_amount));
  }

  /* Gộp chi phí theo PB */
  const costMap = new Map<string, number>();
  for (const c of (costsRes.data || [])) {
    if (!c.dept_id) continue;
    costMap.set(c.dept_id, (costMap.get(c.dept_id) || 0) + Number(c.amount));
  }

  /* Gộp DT nội bộ theo PB */
  const intMap = new Map<string, number>();
  for (const i of (internalRes.data || [])) {
    if (!i.dept_id) continue;
    intMap.set(i.dept_id, (intMap.get(i.dept_id) || 0) + Number(i.total_amount));
  }

  /* Gộp lương theo PB */
  const salMap = new Map<string, number>();
  for (const s of (salaryRes.data || [])) {
    if (!s.dept_id) continue;
    salMap.set(s.dept_id, (salMap.get(s.dept_id) || 0) + Number(s.base_salary));
  }

  /* Quỹ dự kiến */
  const expMap = new Map<string, number>();
  for (const e of (expectedRes.data || [])) {
    expMap.set(e.dept_id, Number(e.expected_fund));
  }

  /* Kết hợp thành kết quả cuối */
  const result = (deptRes.data || []).map((d: any) => {
    const actual = revMap.get(d.id) || 0;
    const internal = intMap.get(d.id) || 0;
    const costs = costMap.get(d.id) || 0;
    const salary = salMap.get(d.id) || 0;
    return {
      dept_id: d.id,
      org_id: d.org_id,
      dept_name: d.name,
      dept_code: d.code,
      expected_fund: expMap.get(d.id) || 0,
      actual_revenue: actual,
      internal_rev: internal,
      total_costs: costs,
      total_salary: salary,
      net_fund: actual + internal - costs - salary,
    };
  });

  return jsonResponse(result);
}
