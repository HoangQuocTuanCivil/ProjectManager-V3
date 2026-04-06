import { NextRequest } from "next/server";
import { verifyCronSecret, getAdminSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();

  const { data: contracts, error } = await admin
    .from("contracts")
    .select("id, org_id, project_id, contract_value, status")
    .eq("status", "active");

  if (error) return errorResponse(error.message, 500);

  let created = 0;

  for (const contract of contracts ?? []) {
    const { data: tasks } = await admin
      .from("tasks")
      .select("progress")
      .eq("project_id", contract.project_id)
      .neq("status", "cancelled");

    if (!tasks || tasks.length === 0) continue;

    const avgProgress = tasks.reduce((s, t) => s + (t.progress ?? 0), 0) / tasks.length;
    const expectedRevenue = Math.round((contract.contract_value * avgProgress) / 100);

    const { data: existing } = await admin
      .from("revenue_entries")
      .select("amount")
      .eq("contract_id", contract.id)
      .eq("method", "completion_rate")
      .eq("status", "confirmed");

    const existingTotal = (existing ?? []).reduce((s, e) => s + Number(e.amount), 0);
    const delta = expectedRevenue - existingTotal;

    if (Math.abs(delta) < 1) continue;

    const { data: adminUser } = await admin
      .from("users")
      .select("id")
      .eq("org_id", contract.org_id)
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminUser) continue;

    const recognitionDate = new Date().toISOString().split("T")[0];
    const { data: entry } = await admin.from("revenue_entries").insert({
      org_id: contract.org_id,
      project_id: contract.project_id,
      contract_id: contract.id,
      dimension: "contract",
      method: "completion_rate",
      source: "manual",
      amount: delta,
      description: `Ghi nhận theo % hoàn thành (${Math.round(avgProgress)}%)`,
      recognition_date: recognitionDate,
      status: "confirmed",
      completion_percentage: Math.round(avgProgress * 100) / 100,
      period_start: recognitionDate,
      period_end: recognitionDate,
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
