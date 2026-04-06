import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

// Báo cáo lãi lỗ theo hợp đồng — dữ liệu từ view v_contract_profitloss.
// Filter theo trạng thái HĐ, dự án, và sắp xếp theo margin.
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  const status = searchParams.get("status");

  let query = supabase.from("v_contract_profitloss").select("*");

  if (project_id) query = query.eq("project_id", project_id);
  if (status && status !== "all") query = query.eq("contract_status", status);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  const contracts = data ?? [];
  const totals = {
    contract_value: contracts.reduce((s, c) => s + Number(c.contract_value), 0),
    total_revenue: contracts.reduce((s, c) => s + Number(c.total_revenue), 0),
    total_costs: contracts.reduce((s, c) => s + Number(c.total_costs), 0),
    profit: contracts.reduce((s, c) => s + Number(c.profit), 0),
  };

  return jsonResponse({ contracts, totals });
}
