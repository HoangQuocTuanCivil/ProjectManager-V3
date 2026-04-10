import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();
  const now = new Date().toISOString();

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, project_id, contract_type, source_allocation_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single() as { data: { id: string; project_id: string; contract_type: string; source_allocation_id: string | null } | null; error: any };

  if (!contract) return errorResponse("Hợp đồng không tồn tại", 404);

  const { count: confirmedCount } = await supabase
    .from("revenue_entries")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", params.id)
    .eq("status", "confirmed");

  if (confirmedCount && confirmedCount > 0) {
    return errorResponse(
      `Không thể xóa: hợp đồng có ${confirmedCount} bút toán doanh thu đã xác nhận. Hãy huỷ các bút toán trước.`,
      400,
    );
  }

  const { error } = await (supabase.from("contracts") as any)
    .update({ deleted_at: now })
    .eq("id", params.id);

  if (error) return errorResponse(error.message, 500);

  if (contract.contract_type === "incoming" && contract.source_allocation_id) {
    await supabase.from("dept_budget_allocations").delete().eq("id", contract.source_allocation_id);
  }

  await (supabase.from("contracts") as any)
    .update({ deleted_at: now })
    .eq("parent_contract_id", params.id)
    .is("deleted_at", null);

  return jsonResponse({ success: true });
}
