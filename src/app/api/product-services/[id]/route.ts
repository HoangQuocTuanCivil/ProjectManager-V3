import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  delete body.id;
  delete body.org_id;
  delete body.created_at;

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("product_services")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);

  return jsonResponse(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  // Guard: check if product_service is used in active contracts or revenue
  const [contractCheck, revenueCheck] = await Promise.all([
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("product_service_id", params.id)
      .is("deleted_at", null),
    supabase
      .from("revenue_entries")
      .select("id", { count: "exact", head: true })
      .eq("product_service_id", params.id)
      .is("deleted_at", null),
  ]);

  const contractCount = contractCheck.count ?? 0;
  const revenueCount = revenueCheck.count ?? 0;

  if (contractCount > 0 || revenueCount > 0) {
    const parts: string[] = [];
    if (contractCount > 0) parts.push(`${contractCount} hợp đồng`);
    if (revenueCount > 0) parts.push(`${revenueCount} doanh thu`);
    return errorResponse(
      `Không thể vô hiệu hóa: sản phẩm/dịch vụ đang được sử dụng bởi ${parts.join(" và ")}`,
      409,
    );
  }

  const { data, error } = await supabase
    .from("product_services")
    .update({ is_active: false })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);

  return jsonResponse(data);
}
