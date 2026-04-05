import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

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
  delete body.id;
  delete body.org_id;
  delete body.created_by;
  delete body.created_at;
  delete body.status;

  const { data, error } = await supabase
    .from("revenue_entries")
    .update(body)
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
