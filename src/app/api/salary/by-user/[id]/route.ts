import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

// Lịch sử lương cá nhân — sắp xếp theo tháng mới nhất
// Chỉ chính NV đó hoặc leader+ mới xem được
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  // NV chỉ xem được lương của chính mình, leader+ xem được tất cả
  if (user.id !== params.id) {
    const roleErr = requireMinRole(profile, "leader");
    if (roleErr) return errorResponse("Không có quyền xem lương người khác", 403);
  }

  const admin = getUntypedAdmin();
  const { data, error } = await admin
    .from("salary_records")
    .select("*, department:departments(id, name, code)")
    .eq("user_id", params.id)
    .order("month", { ascending: false })
    .limit(24);

  if (error) return errorResponse(error.message, 500);

  // Tổng hợp thống kê nhanh từ dữ liệu trả về
  const records = data ?? [];
  const stats = {
    total_months: records.length,
    total_base: records.reduce((s, r) => s + Number(r.base_salary), 0),
    total_deducted: records.reduce((s, r) => s + Number(r.deduction_applied), 0),
    total_net: records.reduce((s, r) => s + Number(r.base_salary) - Number(r.deduction_applied), 0),
  };

  return jsonResponse({ records, stats });
}
