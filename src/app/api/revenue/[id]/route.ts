import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { updateRevenueEntrySchema } from "@/features/revenue/schemas/revenue.schema";

const DETAIL_SELECT = `
  *,
  project:projects(id, code, name),
  contract:contracts(id, contract_no, title),
  department:departments(id, name, code),
  creator:users!revenue_entries_created_by_fkey(id, full_name),
  product_service:product_services(id, code, name, category),
  addendum:contract_addendums(id, addendum_no, title),
  allocations:dept_revenue_allocations(id, dept_id, allocation_percentage, allocated_amount, department:departments(id, name, code))
`;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("revenue_entries")
    .select(DETAIL_SELECT)
    .eq("id", params.id)
    .single();

  if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);

  return jsonResponse(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "team_leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: existing } = await supabase
    .from("revenue_entries")
    .select("status")
    .eq("id", params.id)
    .single();

  if (!existing) return errorResponse("Không tìm thấy bút toán", 404);
  if (existing.status !== "draft") return errorResponse("Chỉ chỉnh sửa được bút toán nháp", 400);

  const body = await req.json();
  const parsed = updateRevenueEntrySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return errorResponse(msg, 422);
  }

  if (parsed.data.project_id) {
    const { error: fkErr } = await supabase
      .from("projects").select("id").eq("id", parsed.data.project_id).is("deleted_at", null).single();
    if (fkErr) return errorResponse("Dự án không tồn tại hoặc đã bị xóa", 400);
  }
  if (parsed.data.contract_id) {
    const { error: fkErr } = await supabase
      .from("contracts").select("id").eq("id", parsed.data.contract_id).is("deleted_at", null).single();
    if (fkErr) return errorResponse("Hợp đồng không tồn tại hoặc đã bị xóa", 400);
  }

  const { data, error } = await supabase
    .from("revenue_entries")
    .update(parsed.data as any)
    .eq("id", params.id)
    .select(DETAIL_SELECT)
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: existing } = await supabase
    .from("revenue_entries")
    .select("status")
    .eq("id", params.id)
    .single();

  if (!existing) return errorResponse("Không tìm thấy bút toán", 404);
  if (existing.status !== "draft") return errorResponse("Chỉ xóa được bút toán nháp", 400);

  const { error } = await supabase
    .from("revenue_entries")
    .delete()
    .eq("id", params.id);

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ success: true });
}
