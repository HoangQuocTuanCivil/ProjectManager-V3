import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { deleteUserDependencies } from "@/lib/api/cascade-delete";

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
      await deleteUserDependencies(admin, targetId, user.id);

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
