import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, parsePagination } from "@/lib/api/helpers";
import { createProjectSchema } from "@/features/projects/schemas/project.schema";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const { from, to, page, per_page } = parsePagination(searchParams);

  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = supabase
    .from("projects")
    .select(`
      *,
      manager:users!projects_manager_id_fkey(id, full_name, avatar_url, role),
      department:departments(id, name, code)
    `, { count: "exact" })
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") query = query.eq("status", status as any);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return errorResponse(msg, 422);
  }

  const { dept_ids, ...projectData } = parsed.data;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...projectData, org_id: profile.org_id })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data, 201);
}
