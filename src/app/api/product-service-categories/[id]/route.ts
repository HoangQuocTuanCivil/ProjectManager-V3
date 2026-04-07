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
    .from("product_service_categories")
    .update(body)
    .eq("id", params.id)
    .select()
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

  const { count } = await supabase
    .from("product_services")
    .select("id", { count: "exact", head: true })
    .eq("category", (await supabase.from("product_service_categories").select("slug").eq("id", params.id).single()).data?.slug ?? "");

  if (count && count > 0) {
    return errorResponse("Không thể xóa phân loại đang được sử dụng", 400);
  }

  const { data, error } = await supabase
    .from("product_service_categories")
    .update({ is_active: false })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data);
}
