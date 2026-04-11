import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { hasMinRole } from "@/lib/utils/permissions";
import type { UserRole } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: entry } = await supabase
    .from("revenue_entries")
    .select(`
      id, status, amount, org_id, project_id, contract_id, dept_id,
      dimension, method, source, description,
      product_service_id, addendum_id, period_start, period_end
    `)
    .eq("id", params.id)
    .single();

  if (!entry) return errorResponse("Không tìm thấy bút toán", 404);
  if (entry.status === "cancelled") return errorResponse("Bút toán đã bị huỷ", 400);

  const role = profile.role as UserRole;
  if (!hasMinRole(role, "director") && entry.dept_id && entry.dept_id !== profile.dept_id) {
    return errorResponse("Bạn chỉ được huỷ bút toán thuộc phòng ban mình", 403);
  }
  if (!hasMinRole(role, "leader") && !entry.dept_id) {
    return errorResponse("Chỉ leader trở lên mới được huỷ bút toán chưa gán phòng ban", 403);
  }

  const { error: updateErr } = await supabase
    .from("revenue_entries")
    .update({ status: "cancelled" })
    .eq("id", params.id);

  if (updateErr) return errorResponse(updateErr.message, 500);

  if (entry.status === "confirmed" && entry.amount !== 0) {
    const today = new Date().toISOString().split("T")[0];
    const { data: offsetEntry, error: insertErr } = await supabase
      .from("revenue_entries")
      .insert({
        org_id: entry.org_id,
        project_id: entry.project_id,
        contract_id: entry.contract_id,
        dept_id: entry.dept_id,
        dimension: entry.dimension,
        method: entry.method,
        source: entry.source,
        amount: -entry.amount,
        description: `Huỷ: ${entry.description}`,
        recognition_date: today,
        status: "confirmed" as const,
        original_entry_id: entry.id,
        product_service_id: entry.product_service_id,
        addendum_id: entry.addendum_id,
        period_start: entry.period_start,
        period_end: entry.period_end,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertErr) return errorResponse(insertErr.message, 500);

    if (offsetEntry) {
      if (entry.project_id) {
        const admin = getAdminSupabase();
        await admin.rpc("fn_allocate_dept_revenue", { p_entry_id: offsetEntry.id });
      }

      await supabase
        .from("revenue_adjustments")
        .update({ revenue_entry_id: offsetEntry.id })
        .eq("revenue_entry_id", params.id);
    }
  }

  return jsonResponse({ success: true });
}
