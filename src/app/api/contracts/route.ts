import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse, parsePagination } from "@/lib/api/helpers";
import { createContractSchema } from "@/features/contracts/schemas/contract.schema";

const CONTRACT_SELECT = `
  *,
  project:projects(id, code, name, budget),
  product_service:product_services(id, code, name, category),
  creator:users!created_by(id, full_name),
  parent_contract:contracts!parent_contract_id(id, contract_no, title),
  addendums:contract_addendums(*, creator:users!created_by(id, full_name)),
  milestones:billing_milestones(*)
`;

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const { from, to, page, per_page } = parsePagination(searchParams);

  const type = searchParams.get("type");
  const projectId = searchParams.get("project_id");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = supabase
    .from("contracts")
    .select(CONTRACT_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (type && type !== "all") query = query.eq("contract_type", type as any);
  if (projectId && projectId !== "all") query = query.eq("project_id", projectId);
  if (status && status !== "all") query = query.eq("status", status as any);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const body = await req.json();
  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return errorResponse(msg, 422);
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("contracts")
    .insert({ ...parsed.data, org_id: profile.org_id, created_by: user.id })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data, 201);
}
