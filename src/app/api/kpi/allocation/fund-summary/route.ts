import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse } from "@/lib/api/helpers";

// Bảng tổng hợp quỹ phòng ban: dự kiến / thực tế / chi phí / lương / còn lại
// Dữ liệu từ view v_dept_fund_summary (toàn thời gian)
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const admin = getUntypedAdmin();
  const { searchParams } = new URL(req.url);
  const dept_id = searchParams.get("dept_id");

  let query = admin.from("v_dept_fund_summary").select("*");

  if (dept_id) query = query.eq("dept_id", dept_id);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}
