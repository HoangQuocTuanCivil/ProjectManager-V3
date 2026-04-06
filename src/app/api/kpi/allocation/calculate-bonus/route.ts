import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

// Tính thưởng khoán cho 1 đợt: gọi fn_calc_bonus trên DB
// Yêu cầu role leader trở lên — thao tác quan trọng ảnh hưởng lương NV
export async function POST(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const { period_id } = await req.json();
  if (!period_id) return errorResponse("period_id is required", 400);

  const admin = getUntypedAdmin();
  const { data, error } = await admin.rpc("fn_calc_bonus", {
    p_period_id: period_id,
  });

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ success: true, results: data });
}
