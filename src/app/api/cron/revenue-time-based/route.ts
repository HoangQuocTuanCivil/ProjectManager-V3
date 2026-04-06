import { NextRequest } from "next/server";
import { verifyCronSecret, getAdminSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const { data: contracts, error } = await admin
    .from("contracts")
    .select("id, org_id, project_id, contract_value, start_date, end_date, status")
    .eq("status", "active")
    .not("start_date", "is", null)
    .not("end_date", "is", null);

  if (error) return errorResponse(error.message, 500);

  let created = 0;

  for (const contract of contracts ?? []) {
    const start = new Date(contract.start_date!);
    const end = new Date(contract.end_date!);
    const totalMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
    const monthlyAmount = Math.round(contract.contract_value / totalMonths);

    if (monthlyAmount <= 0) continue;

    const { data: existing } = await admin
      .from("revenue_entries")
      .select("id")
      .eq("contract_id", contract.id)
      .eq("method", "time_based")
      .gte("recognition_date", `${currentMonth}-01`)
      .lte("recognition_date", `${currentMonth}-31`)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { data: adminUser } = await admin
      .from("users")
      .select("id")
      .eq("org_id", contract.org_id)
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminUser) continue;

    const monthStart = `${currentMonth}-01`;
    // Ngày cuối tháng hiện tại
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const monthEnd = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;

    const { data: entry } = await admin.from("revenue_entries").insert({
      org_id: contract.org_id,
      project_id: contract.project_id,
      contract_id: contract.id,
      dimension: "contract",
      method: "time_based",
      source: "manual",
      amount: monthlyAmount,
      description: `Phân bổ theo thời gian T${today.getMonth() + 1}/${today.getFullYear()}`,
      recognition_date: monthStart,
      status: "confirmed",
      period_start: monthStart,
      period_end: monthEnd,
      created_by: adminUser.id,
    }).select("id").single();

    // Phân bổ doanh thu cho các phòng ban tham gia dự án
    if (entry) {
      await admin.rpc("fn_allocate_dept_revenue", { p_entry_id: entry.id });
    }

    created++;
  }

  return jsonResponse({ success: true, created });
}
