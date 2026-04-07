import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function GET() {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("departments")
    .select("*, head:users!fk_dept_head(id, full_name, avatar_url, role)")
    .eq("org_id", profile.org_id)
    .order("sort_order");

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data || []);
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { name, code, description, head_user_id, center_id, is_executive } = body;

  if (!name || !code) {
    return errorResponse("Tên và mã phòng ban là bắt buộc", 400);
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("departments")
    .insert({
      org_id: profile.org_id,
      name,
      code: code.toUpperCase(),
      description: description || null,
      head_user_id: head_user_id || null,
      center_id: center_id || null,
      is_executive: is_executive ?? false,
    })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data, 201);
}
