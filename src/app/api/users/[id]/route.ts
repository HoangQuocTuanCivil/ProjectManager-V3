import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { hasMinRole } from "@/lib/utils/permissions";
import { deleteUserDependencies } from "@/lib/api/cascade-delete";
import type { UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = ["admin", "leader", "director", "head", "team_leader", "staff"];

const USER_SELECT = "*, department:departments!users_dept_id_fkey(id, name, code)";

const IMMUTABLE_FIELDS = new Set([
  "id", "org_id", "created_at", "email", "department", "team", "custom_role",
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const callerRole = profile.role as UserRole;

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (IMMUTABLE_FIELDS.has(key)) continue;
    updates[key] = value === "" && key.endsWith("_id") ? null : value;
  }

  if (updates.role !== undefined) {
    const newRole = updates.role as UserRole;

    if (!VALID_ROLES.includes(newRole)) {
      return errorResponse("Vai trò không hợp lệ", 422);
    }

    if (params.id === user.id) {
      return errorResponse("Không thể thay đổi vai trò của chính mình", 403);
    }

    if (hasMinRole(newRole, callerRole)) {
      return errorResponse("Không thể gán vai trò bằng hoặc cao hơn vai trò của mình", 403);
    }

    const admin = getAdminSupabase();
    const { data: target } = await admin.from("users").select("role").eq("id", params.id).single();
    if (target && hasMinRole(target.role as UserRole, callerRole)) {
      return errorResponse("Không thể sửa thông tin người có vai trò bằng hoặc cao hơn mình", 403);
    }
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("users")
    .update(updates)
    .eq("id", params.id)
    .select(USER_SELECT)
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
