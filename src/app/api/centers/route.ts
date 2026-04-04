import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function GET() {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("centers")
    .select("*, director:users!centers_director_id_fkey(id, full_name, avatar_url, role, email)")
    .eq("org_id", profile.org_id)
    .order("sort_order");

  if (error) {
    // Fallback if FK name doesn't match — fetch without join
    const { data: d2, error: e2 } = await admin
      .from("centers")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("sort_order");
    if (e2) return errorResponse(e2.message, 500);

    // Fetch directors separately
    const directorIds = [...new Set((d2 || []).map((c: any) => c.director_id).filter(Boolean))];
    let directors: any[] = [];
    if (directorIds.length > 0) {
      const { data: dd } = await admin.from("users").select("id, full_name, avatar_url, role, email").in("id", directorIds);
      directors = dd || [];
    }
    const enriched = (d2 || []).map((c: any) => ({
      ...c,
      director: directors.find((u: any) => u.id === c.director_id) || null,
    }));
    return jsonResponse(enriched);
  }

  return jsonResponse(data || []);
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { name, code, description, director_id } = body;

  if (!name) {
    return errorResponse("Tên trung tâm là bắt buộc", 400);
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("centers")
    .insert({
      org_id: profile.org_id,
      name,
      code: code ? code.toUpperCase() : null,
      description: description || null,
      director_id: director_id || null,
    })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data, 201);
}
