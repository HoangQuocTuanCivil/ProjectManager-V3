import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: entry } = await supabase
    .from("revenue_entries")
    .select("id, status, project_id")
    .eq("id", params.id)
    .single();

  if (!entry) return errorResponse("Không tìm thấy bút toán", 404);
  if (entry.status !== "draft") return errorResponse("Chỉ xác nhận được bút toán nháp", 400);

  const { data, error } = await supabase
    .from("revenue_entries")
    .update({ status: "confirmed" })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  if (entry.project_id) {
    const admin = getAdminSupabase();
    const { error: allocErr } = await admin.rpc("fn_allocate_dept_revenue", { p_entry_id: params.id });
    if (allocErr) console.error("Dept allocation failed:", allocErr.message);
  }

  return jsonResponse(data);
}
