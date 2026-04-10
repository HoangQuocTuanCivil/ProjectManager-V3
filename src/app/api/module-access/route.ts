import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse } from "@/lib/api/helpers";

// GET /api/module-access — danh sách module bị tắt cho user hiện tại
export async function GET() {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  // Admin/leader/director: truy cập tất cả module, không bị giới hạn
  if (["admin", "leader", "director"].includes(profile.role)) {
    return jsonResponse({ disabledModules: [] });
  }

  const admin = getUntypedAdmin();

  // Lấy tất cả module bị tắt theo center hoặc dept của user
  const conditions: string[] = [];
  if (profile.center_id) conditions.push(`and(target_type.eq.center,target_id.eq.${profile.center_id})`);
  if (profile.dept_id) conditions.push(`and(target_type.eq.dept,target_id.eq.${profile.dept_id})`);

  if (conditions.length === 0) {
    return jsonResponse({ disabledModules: [] });
  }

  const { data, error } = await admin
    .from("module_access")
    .select("module_key")
    .eq("org_id", profile.org_id)
    .eq("is_enabled", false)
    .or(conditions.join(","));

  if (error) return errorResponse(error.message, 500);

  const disabledModules = [...new Set((data || []).map((r: any) => r.module_key))];
  return jsonResponse({ disabledModules });
}

// POST /api/module-access — admin cập nhật quyền module (upsert batch)
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  if (profile.role !== "admin") return errorResponse("Chỉ Admin mới có quyền phân quyền module", 403);

  const body = await req.json();
  const { items } = body as {
    items: { module_key: string; target_type: "center" | "dept"; target_id: string; is_enabled: boolean }[];
  };

  if (!items || !Array.isArray(items)) return errorResponse("Thiếu dữ liệu items", 400);

  const admin = getUntypedAdmin();

  // Upsert từng record theo unique constraint (org_id, module_key, target_type, target_id)
  const rows = items.map((item) => ({
    org_id: profile.org_id,
    module_key: item.module_key,
    target_type: item.target_type,
    target_id: item.target_id,
    is_enabled: item.is_enabled,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("module_access")
    .upsert(rows, { onConflict: "org_id,module_key,target_type,target_id" });

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ ok: true });
}
