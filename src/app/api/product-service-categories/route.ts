import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

export async function GET() {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("product_service_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data);
}

export async function POST(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "head");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  if (!body.slug || !body.name) return errorResponse("Thiếu mã hoặc tên phân loại", 400);

  const supabase = await getServerSupabase();

  const { count } = await supabase
    .from("product_service_categories")
    .select("id", { count: "exact", head: true })
    .eq("org_id", profile.org_id);

  const { data, error } = await supabase
    .from("product_service_categories")
    .insert({
      org_id: profile.org_id,
      slug: body.slug,
      name: body.name,
      color: body.color || "bg-gray-500/10 text-gray-600",
      sort_order: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data, 201);
}
