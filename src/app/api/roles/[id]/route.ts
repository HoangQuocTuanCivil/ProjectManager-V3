import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

// PATCH /api/roles/[id] — update a custom role and sync permissions
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { permission_ids = [], id: _id, org_id: _org, created_at: _ca, permissions: _perms, ...updates } = body;

  const admin = getAdminSupabase();

  // Update role metadata
  const { data: role, error } = await admin
    .from("custom_roles")
    .update(updates)
    .eq("id", params.id)
    .eq("org_id", profile.org_id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  // Sync permissions: delete all existing, re-insert
  await admin.from("role_permissions").delete().eq("role_id", params.id);
  if (permission_ids.length > 0) {
    const rows = permission_ids.map((pid: string) => ({
      role_id: params.id,
      permission_id: pid,
    }));
    const { error: permErr } = await admin.from("role_permissions").insert(rows);
    if (permErr) return errorResponse(permErr.message, 500);
  }

  return jsonResponse(role);
}

// DELETE /api/roles/[id] — delete a custom role and its permissions
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "admin");
  if (roleErr) return errorResponse(roleErr, 403);

  const admin = getAdminSupabase();

  // Delete permission mappings first
  await admin.from("role_permissions").delete().eq("role_id", params.id);

  // Delete the custom role
  const { error } = await admin
    .from("custom_roles")
    .delete()
    .eq("id", params.id)
    .eq("org_id", profile.org_id);

  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ success: true });
}
