import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { calculateAllocationSchema } from "@/features/kpi/schemas/allocation.schema";

export async function POST(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const parsed = calculateAllocationSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return errorResponse(msg, 422);
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("fn_allocate_smart", {
    p_period_id: parsed.data.period_id,
    p_use_actual: parsed.data.use_actual,
  });

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ success: true, result: data });
}
