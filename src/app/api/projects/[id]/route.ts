import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      manager:users!projects_manager_id_fkey(*),
      department:departments(*),
      members:project_members(*, user:users(*)),
      milestones:milestones(*)
    `)
    .eq("id", params.id)
    .single();

  if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);

  return jsonResponse(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "director");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const supabase = await getServerSupabase();

  delete body.id;
  delete body.org_id;
  delete body.created_at;

  const { data, error } = await supabase
    .from("projects")
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

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();

  // Soft delete: archive
  const { error } = await supabase
    .from("projects")
    .update({ status: "archived" })
    .eq("id", params.id);

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ success: true });
}
