import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

// Từ chối doanh thu nội bộ: đặt status = pending (trả về cho PB trưởng sửa lại)
// Không xoá bản ghi — giữ lại cho PB trưởng chỉnh sửa và gửi duyệt lại.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: entry } = await supabase
    .from("internal_revenue")
    .select("id, status, org_id")
    .eq("id", params.id)
    .single();

  if (!entry) return errorResponse("Không tìm thấy bản ghi DT nội bộ", 404);
  if (entry.org_id !== profile.org_id) return errorResponse("Không có quyền", 403);
  if (entry.status === "pending") return errorResponse("Bản ghi đang ở trạng thái chờ, không cần từ chối", 400);

  const { data, error } = await supabase
    .from("internal_revenue")
    .update({ status: "pending" })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}
