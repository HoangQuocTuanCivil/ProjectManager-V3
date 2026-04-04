import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, parsePagination } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("projects")
    .select(`
      *,
      manager:users!projects_manager_id_fkey(id, full_name, avatar_url, role),
      department:departments(id, name, code)
    `)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status as any);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data });
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const body = await req.json();
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...body, org_id: profile.org_id })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data, 201);
}
