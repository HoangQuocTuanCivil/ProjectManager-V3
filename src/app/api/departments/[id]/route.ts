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
  const { error } = await admin
    .from("departments")
    .update({ is_active: false })
    .eq("id", params.id)
    .eq("org_id", profile.org_id);

  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ success: true });
}
