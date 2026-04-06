import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { id: _id, org_id: _org, created_at: _ca, email: _email, department: _dept, team: _team, custom_role: _cr, ...updates } = body;

  // Clean empty strings → null for UUID FK columns
  if (updates.team_id === "") updates.team_id = null;
  if (updates.custom_role_id === "") updates.custom_role_id = null;

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("users")
    .update(updates)
    .eq("id", params.id)
    .select("*, department:departments!users_dept_id_fkey(id, name, code)")
    .single();

  if (error) return errorResponse(error.message, 500);

  // If is_active changed, ban/unban auth user
  if (typeof updates.is_active === "boolean") {
    if (updates.is_active) {
      await admin.auth.admin.updateUserById(params.id, { ban_duration: "none" });
    } else {
      await admin.auth.admin.updateUserById(params.id, { ban_duration: "876000h" });
    }
  }

  return jsonResponse(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const targetId = params.id;
  if (targetId === user.id) return errorResponse("Không thể xóa chính mình", 400);

  const admin = getAdminSupabase();

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

  // Delete user record (CASCADE handles notifications, sessions, kpi_records, etc.)
  const { error } = await admin.from("users").delete().eq("id", targetId);
  if (error) return errorResponse(error.message, 500);

  // Delete auth user from Supabase Auth
  await admin.auth.admin.deleteUser(targetId);

  return jsonResponse({ success: true });
}
