import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { hasMinRole } from "@/lib/utils/permissions";
import { deleteUserDependencies } from "@/lib/api/cascade-delete";
import type { UserRole } from "@/lib/types";

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
  const callerRole = profile.role as UserRole;

  const { data: targets } = await admin
    .from("users")
    .select("id, org_id, role")
    .in("id", safeIds);

  const validIds = (targets || [])
    .filter((t) => t.org_id === profile.org_id && !hasMinRole(t.role as UserRole, callerRole))
    .map((t) => t.id);

  if (validIds.length === 0) {
    return errorResponse("Không có người dùng hợp lệ để xóa", 400);
  }

  const errors: string[] = [];

  for (const targetId of validIds) {
    try {
      await deleteUserDependencies(admin, targetId, user.id);

      const { error } = await admin.from("users").delete().eq("id", targetId);
      if (error) { errors.push(`${targetId}: ${error.message}`); continue; }

      await admin.auth.admin.deleteUser(targetId);
    } catch (e: any) {
      errors.push(`${targetId}: ${e.message}`);
    }
  }

  return jsonResponse({
    deleted: validIds.length - errors.length,
    skipped: safeIds.length - validIds.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
