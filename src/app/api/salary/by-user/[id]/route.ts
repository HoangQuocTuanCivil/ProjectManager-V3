import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

// Lịch sử lương cá nhân — sắp xếp theo tháng mới nhất
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
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
