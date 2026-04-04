import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const { password } = await req.json();
  if (!password || password.length < 6) {
    return errorResponse("Mật khẩu phải có ít nhất 6 ký tự", 400);
  }

  const admin = getAdminSupabase();
  const { error } = await admin.auth.admin.updateUserById(params.id, { password });

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ success: true });
}
