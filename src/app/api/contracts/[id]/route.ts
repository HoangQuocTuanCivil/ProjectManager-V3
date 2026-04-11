import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { updateContractSchema } from "@/features/contracts/schemas/contract.schema";

const CONTRACT_DETAIL_SELECT = `
  *,
  project:projects(id, code, name, budget),
  product_service:product_services(id, code, name, category),
  creator:users!created_by(id, full_name),
  parent_contract:contracts!parent_contract_id(id, contract_no, title),
  addendums:contract_addendums(*, creator:users!created_by(id, full_name)),
  milestones:billing_milestones(*)
`;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("contracts")
    .select(CONTRACT_DETAIL_SELECT)
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);

  return jsonResponse(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: existing } = await supabase
    .from("contracts")
    .select("id, status")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  if (!existing) return errorResponse("Hợp đồng không tồn tại", 404);

  const body = await req.json();
  const parsed = updateContractSchema.safeParse({ ...body, id: params.id });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return errorResponse(msg, 422);
  }

  const { id: _id, ...updates } = parsed.data;

  if (parsed.data.project_id) {
    const { error: fkErr } = await supabase
      .from("projects").select("id").eq("id", parsed.data.project_id).is("deleted_at", null).single();
    if (fkErr) return errorResponse("Dự án không tồn tại hoặc đã bị xóa", 400);
  }

  const { data, error } = await supabase
    .from("contracts")
    .update(updates)
    .eq("id", params.id)
    .is("deleted_at", null)
    .select(CONTRACT_DETAIL_SELECT)
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, project_id, contract_type, source_allocation_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: { id: string; project_id: string; contract_type: string; source_allocation_id: string | null } | null; error: any };

  if (!contract) return errorResponse("Hợp đồng không tồn tại", 404);

  const { count: confirmedCount } = await (supabase
    .from("revenue_entries") as any)
    .select("id", { count: "exact", head: true })
    .eq("contract_id", params.id)
    .eq("status", "confirmed")
    .is("deleted_at", null);

  if (confirmedCount && confirmedCount > 0) {
    return errorResponse(
      `Không thể xóa: hợp đồng có ${confirmedCount} bút toán doanh thu đã xác nhận. Hãy huỷ các bút toán trước.`,
      400,
    );
  }

  const now = new Date().toISOString();

  const { error } = await (supabase.from("contracts") as any)
    .update({ deleted_at: now })
    .eq("id", params.id);

  if (error) return errorResponse(error.message, 500);

  if (contract.contract_type === "incoming" && contract.source_allocation_id) {
    await (supabase.from("dept_budget_allocations") as any)
      .update({ deleted_at: now })
      .eq("id", contract.source_allocation_id);
  }

  await (supabase.from("contracts") as any)
    .update({ deleted_at: now })
    .eq("parent_contract_id", params.id)
    .is("deleted_at", null);

  return jsonResponse({ success: true });
}
