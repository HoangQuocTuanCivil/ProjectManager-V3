import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole, parsePagination } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const { from, to, page, per_page } = parsePagination(searchParams);

  let query = supabase
    .from("product_services")
    .select("*", { count: "exact" })
    .order("code", { ascending: true })
    .range(from, to);

  const category = searchParams.get("category");
  const is_active = searchParams.get("is_active");
  const search = searchParams.get("search");

  if (category && category !== "all") query = query.eq("category", category);
  if (is_active !== null && is_active !== "all") query = query.eq("is_active", is_active === "true");
  if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}

export async function POST(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();

  if (!body.code || !body.name) {
    return errorResponse("Thiếu mã hoặc tên sản phẩm/dịch vụ", 400);
  }

  const supabase = await getServerSupabase();

  const { data: existing } = await supabase
    .from("product_services")
    .select("id")
    .eq("code", body.code)
    .maybeSingle();

  if (existing) return errorResponse("Mã sản phẩm/dịch vụ đã tồn tại", 409);

  const { data, error } = await supabase
    .from("product_services")
    .insert({ ...body, org_id: profile.org_id })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data, 201);
}
