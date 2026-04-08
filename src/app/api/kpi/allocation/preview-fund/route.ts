import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";

/** Preview quỹ khoán từ nghiệm thu giao khoán.
 *  Tìm giao khoán thuộc trung tâm, lấy đợt NT trong khoảng ngày,
 *  group theo dự án → trả danh sách dự án + tổng NT trong kỳ. */
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);
  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const { searchParams } = new URL(req.url);
  const center_id = searchParams.get("center_id");
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");
  const project_id = searchParams.get("project_id");

  if (!center_id) return errorResponse("center_id là bắt buộc", 400);

  const admin = getUntypedAdmin();

  /* Lấy giao khoán thuộc trung tâm (có thể lọc thêm theo dự án) */
  let allocQuery = admin
    .from("dept_budget_allocations")
    .select("id, project_id, contract_id, allocation_code, allocated_amount, project:projects(id, code, name)")
    .eq("center_id", center_id);
  if (project_id) allocQuery = allocQuery.eq("project_id", project_id);

  const { data: allocations, error: allocErr } = await allocQuery;
  if (allocErr) return errorResponse(allocErr.message, 500);
  if (!allocations || allocations.length === 0) return jsonResponse([]);

  /* Lấy đợt NT cho các giao khoán, lọc theo khoảng ngày */
  const allocIds = allocations.map((a: any) => a.id);
  let roundsQuery = admin
    .from("acceptance_rounds")
    .select("id, allocation_id, amount, round_date, round_name")
    .in("allocation_id", allocIds);
  if (start_date) roundsQuery = roundsQuery.gte("round_date", start_date);
  if (end_date) roundsQuery = roundsQuery.lte("round_date", end_date);

  const { data: rounds, error: roundsErr } = await roundsQuery;
  if (roundsErr) return errorResponse(roundsErr.message, 500);

  /* Tổng NT theo allocation_id */
  const ntByAlloc = new Map<string, number>();
  for (const r of (rounds || [])) {
    ntByAlloc.set(r.allocation_id, (ntByAlloc.get(r.allocation_id) || 0) + Number(r.amount));
  }

  /* Group theo project_id: gộp tổng NT từ tất cả giao khoán của dự án */
  const projectMap = new Map<string, {
    project_id: string; project_code: string; project_name: string;
    allocations: { id: string; allocation_code: string; allocated_amount: number; accepted_in_period: number }[];
    total_accepted: number;
  }>();

  for (const a of allocations) {
    const proj = a.project as any;
    if (!proj) continue;
    const pid = proj.id;
    if (!projectMap.has(pid)) {
      projectMap.set(pid, {
        project_id: pid,
        project_code: proj.code || "",
        project_name: proj.name || "",
        allocations: [],
        total_accepted: 0,
      });
    }
    const group = projectMap.get(pid)!;
    const accepted = ntByAlloc.get(a.id) || 0;
    group.allocations.push({
      id: a.id,
      allocation_code: a.allocation_code || "",
      allocated_amount: Number(a.allocated_amount),
      accepted_in_period: accepted,
    });
    group.total_accepted += accepted;
  }

  return jsonResponse(Array.from(projectMap.values()));
}
