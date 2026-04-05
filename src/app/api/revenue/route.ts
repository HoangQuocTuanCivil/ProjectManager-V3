import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, requireMinRole, parsePagination } from "@/lib/api/helpers";

const REVENUE_SELECT = `
  *,
  project:projects(id, code, name),
  contract:contracts(id, contract_no, title),
  department:departments(id, name, code),
  creator:users!revenue_entries_created_by_fkey(id, full_name),
  product_service:product_services(id, code, name, category),
  addendum:contract_addendums(id, addendum_no, title)
`;

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const { from, to, page, per_page } = parsePagination(searchParams);

  let query = supabase
    .from("revenue_entries")
    .select(REVENUE_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const status = searchParams.get("status");
  const dimension = searchParams.get("dimension");
  const method = searchParams.get("method");
  const source = searchParams.get("source");
  const project_id = searchParams.get("project_id");
  const contract_id = searchParams.get("contract_id");
  const dept_id = searchParams.get("dept_id");
  const product_service_id = searchParams.get("product_service_id");
  const date_from = searchParams.get("date_from");
  const date_to = searchParams.get("date_to");
  const search = searchParams.get("search");

  if (status && status !== "all") query = query.eq("status", status as any);
  if (dimension && dimension !== "all") query = query.eq("dimension", dimension as any);
  if (method && method !== "all") query = query.eq("method", method as any);
  if (source && source !== "all") query = query.eq("source", source as any);
  if (project_id && project_id !== "all") query = query.eq("project_id", project_id);
  if (contract_id && contract_id !== "all") query = query.eq("contract_id", contract_id);
  if (dept_id && dept_id !== "all") query = query.eq("dept_id", dept_id);
  if (product_service_id) query = query.eq("product_service_id", product_service_id);
  if (date_from) query = query.gte("recognition_date", date_from);
  if (date_to) query = query.lte("recognition_date", date_to);
  if (search) query = query.ilike("description", `%${search}%`);

  const sort = searchParams.get("sort");
  if (sort) {
    const desc = sort.startsWith("-");
    const col = desc ? sort.slice(1) : sort;
    query = query.order(col, { ascending: !desc });
  }

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "team_leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();

  if (!body.description || body.amount === undefined) {
    return errorResponse("Thiếu mô tả hoặc số tiền", 400);
  }
  if (typeof body.amount !== "number" || body.amount === 0) {
    return errorResponse("Số tiền không hợp lệ", 400);
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("revenue_entries")
    .insert({
      ...body,
      org_id: profile.org_id,
      status: "draft",
      created_by: user.id,
    })
    .select(REVENUE_SELECT)
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data, 201);
}
