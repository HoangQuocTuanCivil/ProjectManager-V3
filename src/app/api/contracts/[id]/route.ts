import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const supabase = await getServerSupabase();
  const { error } = await (supabase
    .from("contracts") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)
    .is("deleted_at", null);

  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ success: true });
}
