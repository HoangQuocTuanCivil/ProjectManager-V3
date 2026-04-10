import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { createAcceptanceRoundSchema } from "@/features/kpi/schemas/allocation.schema";

/** GET: batch fetch đợt nghiệm thu cho nhiều giao khoán
 *  Query: allocation_ids=id1,id2,... */
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("allocation_ids")?.split(",").filter(Boolean);
  if (!ids || ids.length === 0) return jsonResponse([]);

  const admin = getUntypedAdmin();
  const { data, error } = await admin
    .from("acceptance_rounds")
    .select("*")
    .eq("org_id", profile.org_id)
    .in("allocation_id", ids)
    .order("sort_order", { ascending: true });

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data);
}

/** POST: tạo đợt nghiệm thu mới */
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const parsed = createAcceptanceRoundSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return errorResponse(msg, 422);
  }

  const admin = getUntypedAdmin();
  const { data, error } = await admin
    .from("acceptance_rounds")
    .insert({
      ...parsed.data,
      round_date: parsed.data.round_date || null,
      note: parsed.data.note || null,
      org_id: profile.org_id,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data, 201);
}

/** PATCH: cập nhật đợt nghiệm thu */
export async function PATCH(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { id, round_name, amount, round_date, note, sort_order } = body;
  if (!id) return errorResponse("Thiếu id", 400);

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (round_name !== undefined) updates.round_name = round_name;
  if (amount !== undefined) updates.amount = amount;
  if (round_date !== undefined) updates.round_date = round_date || null;
  if (note !== undefined) updates.note = note || null;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const admin = getUntypedAdmin();
  const { data, error } = await admin
    .from("acceptance_rounds")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data);
}

/** DELETE: xóa đợt nghiệm thu */
export async function DELETE(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return errorResponse("Thiếu id", 400);

  const admin = getUntypedAdmin();
  const { error } = await admin.from("acceptance_rounds").delete().eq("id", id);
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ success: true });
}
