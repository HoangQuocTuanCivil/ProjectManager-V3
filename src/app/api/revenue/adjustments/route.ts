import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, parsePagination } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const { from, to, page, per_page } = parsePagination(searchParams);

  let query = supabase
    .from("revenue_adjustments")
    .select(`
      *,
      contract:contracts(id, contract_no, title, project:projects(id, code, name)),
      addendum:contract_addendums(id, addendum_no, title, value_change),
      adjuster:users!revenue_adjustments_adjusted_by_fkey(id, full_name)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const contract_id = searchParams.get("contract_id");
  if (contract_id) query = query.eq("contract_id", contract_id);

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}
