import { NextRequest } from "next/server";
import { verifyCronSecret, getAdminSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

const ALERT_DAYS = [30, 15, 7] as const;

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();
  const today = new Date();
  const alertDate = new Date(today);
  alertDate.setDate(alertDate.getDate() + Math.max(...ALERT_DAYS));

  const { data: contracts, error } = await admin
    .from("contracts")
    .select("id, org_id, project_id, contract_no, title, guarantee_expiry, guarantee_value, project:projects(name, manager_id)")
    .is("deleted_at", null)
    .in("status", ["active", "completed"])
    .not("guarantee_expiry", "is", null)
    .lte("guarantee_expiry", alertDate.toISOString().split("T")[0])
    .gte("guarantee_expiry", today.toISOString().split("T")[0]);

  if (error) return errorResponse(error.message, 500);
  if (!contracts || contracts.length === 0) return jsonResponse({ sent: 0 });

  const notifications: {
    org_id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    link: string;
  }[] = [];

  for (const c of contracts) {
    const expiry = new Date(c.guarantee_expiry!);
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);

    if (!ALERT_DAYS.some((d) => daysLeft <= d)) continue;

    const project = Array.isArray(c.project) ? c.project[0] : c.project;
    const managerId = project?.manager_id;
    if (!managerId) continue;

    notifications.push({
      org_id: c.org_id,
      user_id: managerId,
      type: "system",
      title: `Bảo lãnh HĐ "${c.contract_no}" sắp hết hạn`,
      message: `Hợp đồng "${c.title}" — bảo lãnh hết hạn sau ${daysLeft} ngày (${c.guarantee_expiry}).`,
      link: `/contracts`,
    });
  }

  if (notifications.length > 0) {
    await (admin.from("notifications") as any).insert(notifications);
  }

  return jsonResponse({ sent: notifications.length });
}
