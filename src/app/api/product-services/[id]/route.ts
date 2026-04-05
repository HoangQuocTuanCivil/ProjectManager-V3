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
  const { data, error } = await supabase
    .from("product_services")
    .update({ is_active: false })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);

  return jsonResponse(data);
}
