import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { deleteUserDependencies } from "@/lib/api/cascade-delete";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { id: _id, org_id: _org, created_at: _ca, email: _email, department: _dept, team: _team, custom_role: _cr, ...updates } = body;

  if (updates.center_id === "") updates.center_id = null;
  if (updates.dept_id === "") updates.dept_id = null;
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

  await deleteUserDependencies(admin, targetId, user.id);

  const { error } = await admin.from("users").delete().eq("id", targetId);
  if (error) return errorResponse(error.message, 500);

  await admin.auth.admin.deleteUser(targetId);

  return jsonResponse({ success: true });
}
