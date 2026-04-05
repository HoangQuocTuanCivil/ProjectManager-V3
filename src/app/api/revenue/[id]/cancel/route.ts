import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  const { data: entry } = await supabase
    .from("revenue_entries")
    .select("id, status, amount, org_id, project_id, contract_id, dept_id, dimension, method, description")
    .eq("id", params.id)
    .single();

  if (!entry) return errorResponse("Không tìm thấy bút toán", 404);
  if (entry.status === "cancelled") return errorResponse("Bút toán đã bị huỷ", 400);

  const { error: updateErr } = await supabase
    .from("revenue_entries")
    .update({ status: "cancelled" })
    .eq("id", params.id);

  if (updateErr) return errorResponse(updateErr.message, 500);

  if (entry.status === "confirmed" && entry.amount !== 0) {
    await supabase
      .from("revenue_entries")
      .insert({
        org_id: entry.org_id,
        project_id: entry.project_id,
        contract_id: entry.contract_id,
        dept_id: entry.dept_id,
        dimension: entry.dimension,
        method: entry.method,
        source: "manual" as const,
        amount: -entry.amount,
        description: `Huỷ: ${entry.description}`,
        recognition_date: new Date().toISOString().split("T")[0],
        status: "confirmed" as const,
        original_entry_id: entry.id,
        created_by: user.id,
      });
  }

  return jsonResponse({ success: true });
}
