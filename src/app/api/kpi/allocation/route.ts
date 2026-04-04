import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { period_id, use_actual = true } = body;

  if (!period_id) return errorResponse("period_id is required", 400);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("fn_allocate_smart", {
    p_period_id: period_id,
    p_use_actual: use_actual,
  });

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ success: true, result: data });
}
