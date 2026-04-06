import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

// Lấy cấu hình kỳ khoán của org hiện tại (mỗi org chỉ có 1)
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("allocation_cycle_config")
    .select("*")
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}

// Tạo hoặc cập nhật cấu hình kỳ khoán (upsert trên org_id unique)
export async function PATCH(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "director");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("allocation_cycle_config")
    .upsert({
      org_id: profile.org_id,
      cycle_months: body.cycle_months,
      start_month: body.start_month,
      is_active: body.is_active ?? true,
    }, { onConflict: "org_id" })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}
