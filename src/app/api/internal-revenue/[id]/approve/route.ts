import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

// Duyệt doanh thu nội bộ: pending → approved (kế toán) hoặc approved → recorded (GĐ)
// Chỉ admin/leader/director có quyền. Entry approved sẽ được fn_calc_actual_fund tính vào quỹ PB.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: entry } = await supabase
    .from("internal_revenue")
    .select("id, status")
    .eq("id", params.id)
    .single();

  if (!entry) return errorResponse("Không tìm thấy bản ghi DT nội bộ", 404);

  // Xác định bước duyệt tiếp theo dựa trên trạng thái hiện tại
  const nextStatus = entry.status === "pending" ? "approved" : entry.status === "approved" ? "recorded" : null;
  if (!nextStatus) return errorResponse(`Không thể duyệt bản ghi ở trạng thái "${entry.status}"`, 400);

  const { data, error } = await supabase
    .from("internal_revenue")
    .update({ status: nextStatus })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}
