import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse } from "@/lib/api/helpers";

// GET /api/module-access/all — admin xem toàn bộ cấu hình module access
export async function GET() {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  if (profile.role !== "admin") return errorResponse("Chỉ Admin mới có quyền xem cấu hình", 403);

  const admin = getUntypedAdmin();
  const { data, error } = await admin
    .from("module_access")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("target_type")
    .order("module_key");

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ items: data || [] });
}
