import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) return errorResponse("Danh sách rỗng", 400);

  const safeIds = ids.filter((id: string) => id !== user.id);
  if (safeIds.length === 0) return errorResponse("Không thể xóa chính mình", 400);

  const admin = getAdminSupabase();
  const errors: string[] = [];

  for (const targetId of safeIds) {
    try {
      await Promise.all([
        admin.from("goals").update({ owner_id: null }).eq("owner_id", targetId),
        admin.from("departments").update({ head_user_id: null }).eq("head_user_id", targetId),
        admin.from("centers").update({ director_id: null }).eq("director_id", targetId),
        admin.from("teams").update({ leader_id: null }).eq("leader_id", targetId),
        admin.from("projects").update({ manager_id: null }).eq("manager_id", targetId),
        admin.from("tasks").update({ kpi_evaluated_by: null }).eq("kpi_evaluated_by", targetId),
        admin.from("tasks").update({ assigner_id: user.id }).eq("assigner_id", targetId),
        admin.from("tasks").update({ assignee_id: null }).eq("assignee_id", targetId),
        admin.from("workflow_steps").update({ assigned_user_id: null }).eq("assigned_user_id", targetId),
        admin.from("audit_logs").update({ user_id: null }).eq("user_id", targetId),
        admin.from("task_comments").delete().eq("user_id", targetId),
        admin.from("task_status_logs").delete().eq("user_id", targetId),
        admin.from("allocation_results").delete().eq("user_id", targetId),
        admin.from("user_invitations").delete().eq("invited_by", targetId),
        admin.from("task_scores").delete().eq("scored_by", targetId),
        admin.from("task_attachments").delete().eq("uploaded_by", targetId),
        admin.from("time_entries").delete().eq("user_id", targetId),
        admin.from("dashboards").delete().eq("owner_id", targetId),
        admin.from("task_proposals" as any).update({ approver_id: null }).eq("approver_id", targetId),
        admin.from("task_proposals").delete().eq("proposed_by", targetId),
        admin.from("allocation_periods").update({ approved_by: null }).eq("approved_by", targetId),
      ]);

      const { error } = await admin.from("users").delete().eq("id", targetId);
      if (error) { errors.push(`${targetId}: ${error.message}`); continue; }

      await admin.auth.admin.deleteUser(targetId);
    } catch (e: any) {
      errors.push(`${targetId}: ${e.message}`);
    }
  }

  return jsonResponse({
    deleted: safeIds.length - errors.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
