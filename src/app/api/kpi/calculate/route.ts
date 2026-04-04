import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin.functions.invoke("calculate-kpi", {
      body: { triggered_by: profile.id },
    });

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({ success: true, result: data });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to calculate KPI", 500);
  }
}
