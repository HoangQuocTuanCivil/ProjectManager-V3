import { NextRequest } from "next/server";
import { verifyCronSecret, getAdminSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();
  const today = new Date().toISOString().split("T")[0];

  const { data: milestones, error } = await admin
    .from("billing_milestones")
    .select("id, contract_id, title, amount, due_date, contract:contracts!inner(org_id, project_id, deleted_at)")
    .eq("status", "upcoming")
    .lt("due_date", today)
    .is("contract.deleted_at", null);

  if (error) return errorResponse(error.message, 500);

  let updated = 0;
  const notifications: Array<{ org_id: string; title: string; milestone_id: string }> = [];

  for (const m of milestones ?? []) {
    const { error: updateErr } = await admin
      .from("billing_milestones")
      .update({ status: "overdue" })
      .eq("id", m.id);

    if (updateErr) continue;

    updated++;
    const contract = m.contract as any;
    if (contract?.org_id) {
      notifications.push({
        org_id: contract.org_id,
        title: `Mốc thanh toán quá hạn: ${m.title} (${Number(m.amount).toLocaleString("vi-VN")}đ)`,
        milestone_id: m.id,
      });
    }
  }

  for (const n of notifications) {
    const { data: admins } = await admin
      .from("users")
      .select("id")
      .eq("org_id", n.org_id)
      .in("role", ["admin", "leader", "director"]);

    for (const u of admins ?? []) {
      try {
        await admin.from("notifications").insert({
          org_id: n.org_id,
          user_id: u.id,
          title: n.title,
          type: "system" as const,
        });
      } catch {}
    }
  }

  return jsonResponse({ success: true, updated, notified: notifications.length });
}
