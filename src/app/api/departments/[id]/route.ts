import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { id: _id, org_id: _org, created_at: _ca, head: _head, is_executive: _exec, ...updates } = body;

  if (updates.head_user_id === "") updates.head_user_id = null;

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("departments")
    .update(updates)
    .eq("id", params.id)
    .eq("org_id", profile.org_id)
    .select("*, head:users!fk_dept_head(id, full_name, avatar_url, role)")
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "admin");
  if (roleErr) return errorResponse(roleErr, 403);

  const admin = getAdminSupabase();
  const deptId = params.id;
  const orgId = profile.org_id;

  /* Lấy danh sách nhóm thuộc phòng ban để reset team_id của users */
  const { data: teams } = await admin
    .from("teams")
    .select("id")
    .eq("dept_id", deptId);
  const teamIds = (teams ?? []).map((t: any) => t.id);

  await admin.from("projects").update({ dept_id: null }).eq("dept_id", deptId);
  await admin.from("goals").update({ dept_id: null }).eq("dept_id", deptId);
  await admin.from("workflow_templates").update({ dept_id: null }).eq("dept_id", deptId);
  await admin.from("project_departments").delete().eq("dept_id", deptId);

  /* Reset dept_id và team_id của tất cả users thuộc phòng ban */
  await admin
    .from("users")
    .update({ dept_id: null, team_id: null })
    .eq("dept_id", deptId);

  /* Nếu có users thuộc nhóm trong phòng ban nhưng dept_id khác, reset team_id */
  if (teamIds.length > 0) {
    await admin
      .from("users")
      .update({ team_id: null })
      .in("team_id", teamIds);
  }

  /* Xóa tất cả nhóm thuộc phòng ban */
  if (teamIds.length > 0) {
    await admin.from("teams").delete().in("id", teamIds);
  }

  /* Xóa phòng ban */
  const { error } = await admin
    .from("departments")
    .delete()
    .eq("id", deptId)
    .eq("org_id", orgId);

  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ success: true });
}
