import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { hasMinRole } from "@/lib/utils/permissions";
import type { UserRole } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: entry } = await supabase
    .from("revenue_entries")
    .select("id, status, project_id, dept_id, created_by")
    .eq("id", params.id)
    .single();

  if (!entry) return errorResponse("Không tìm thấy bút toán", 404);
  if (entry.status !== "draft") return errorResponse("Chỉ xác nhận được bút toán nháp", 400);

  const role = profile.role as UserRole;
  if (!hasMinRole(role, "director") && entry.dept_id && entry.dept_id !== profile.dept_id) {
    return errorResponse("Bạn chỉ được xác nhận bút toán thuộc phòng ban mình", 403);
  }
  if (!hasMinRole(role, "leader") && !entry.dept_id) {
    return errorResponse("Chỉ leader trở lên mới được xác nhận bút toán chưa gán phòng ban", 403);
  }

  if (entry.project_id) {
    const admin = getAdminSupabase();
    const { error: allocErr } = await admin.rpc("fn_allocate_dept_revenue", { p_entry_id: params.id });

    if (allocErr) {
      return errorResponse(`Phân bổ doanh thu thất bại: ${allocErr.message}`, 500);
    }

    const { data: recheck } = await supabase
      .from("revenue_entries")
      .select("status")
      .eq("id", params.id)
      .single();

    if (recheck?.status === "draft") {
      return errorResponse("Phân bổ thất bại: dự án chưa có phòng ban. Vui lòng thêm phòng ban vào dự án trước.", 422);
    }

    return jsonResponse(recheck);
  }

  const { data, error } = await supabase
    .from("revenue_entries")
    .update({ status: "confirmed" })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}
