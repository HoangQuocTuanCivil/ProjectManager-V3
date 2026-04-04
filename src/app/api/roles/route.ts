import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

// GET /api/roles — fetch custom roles with permissions + all permissions
export async function GET() {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();

  // Fetch custom roles with their permission mappings
  const { data: roles, error: rolesErr } = await admin
    .from("custom_roles")
    .select("*, permissions:role_permissions(permission_id)")
    .eq("org_id", profile.org_id)
    .order("created_at");

  if (rolesErr) return errorResponse(rolesErr.message, 500);

  // Fetch all permissions
  const { data: permissions, error: permsErr } = await admin
    .from("permissions")
    .select("*")
    .order("sort_order");

  if (permsErr) return errorResponse(permsErr.message, 500);

  return jsonResponse({ roles: roles || [], permissions: permissions || [] });
}

// POST /api/roles — create a new custom role with permissions
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { name, description, base_role, color, permission_ids = [] } = body;

  if (!name) return errorResponse("Tên vai trò là bắt buộc", 400);

  const admin = getAdminSupabase();

  // Create the custom role
  const { data: role, error } = await admin
    .from("custom_roles")
    .insert({
      org_id: profile.org_id,
      name,
      description: description || null,
      base_role: base_role || "staff",
      color: color || "#6366f1",
    })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  // Insert permission mappings
  if (permission_ids.length > 0) {
    const rows = permission_ids.map((pid: string) => ({
      role_id: role.id,
      permission_id: pid,
    }));
    const { error: permErr } = await admin.from("role_permissions").insert(rows);
    if (permErr) return errorResponse(permErr.message, 500);
  }

  return jsonResponse(role, 201);
}
