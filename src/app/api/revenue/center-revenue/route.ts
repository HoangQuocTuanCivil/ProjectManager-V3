import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const { data: allocations, error: allocErr } = await supabase
    .from("dept_budget_allocations")
    .select("project_id, contract_id, center_id, allocated_amount, delivery_date, center:centers(id, name, code)")
    .not("center_id", "is", null);

  if (allocErr) return errorResponse(allocErr.message, 500);

  const { data: contracts, error: ctErr } = await supabase
    .from("contracts")
    .select("id, project_id, contract_type, contract_value, product_service_id, status, product_service:product_services(id, code, name, category)")
    .eq("contract_type", "outgoing")
    .in("status", ["active", "completed"]);

  if (ctErr) return errorResponse(ctErr.message, 500);

  const validAllocations = (allocations ?? []).filter((a) => {
    if (!a.center_id) return false;
    if (from && a.delivery_date && a.delivery_date < from) return false;
    if (to && a.delivery_date && a.delivery_date > to) return false;
    return true;
  });

  const projectTotalAlloc = new Map<string, number>();
  for (const a of validAllocations) {
    projectTotalAlloc.set(a.project_id, (projectTotalAlloc.get(a.project_id) || 0) + Number(a.allocated_amount));
  }

  const centerAllocByProject = new Map<string, Map<string, number>>();
  const centerInfo = new Map<string, { name: string; code: string }>();

  for (const a of validAllocations) {
    const center = a.center as any;
    if (!center) continue;
    centerInfo.set(a.center_id!, { name: center.name, code: center.code ?? "" });

    const key = `${a.project_id}::${a.center_id}`;
    if (!centerAllocByProject.has(a.project_id)) centerAllocByProject.set(a.project_id, new Map());
    const projMap = centerAllocByProject.get(a.project_id)!;
    projMap.set(a.center_id!, (projMap.get(a.center_id!) || 0) + Number(a.allocated_amount));
  }

  const contractsByProject = new Map<string, typeof contracts>();
  for (const c of contracts ?? []) {
    if (!contractsByProject.has(c.project_id)) contractsByProject.set(c.project_id, []);
    contractsByProject.get(c.project_id)!.push(c);
  }

  type CenterAgg = {
    center_id: string;
    center_name: string;
    center_code: string;
    total_revenue: number;
    project_count: Set<string>;
    by_product_service: Map<string, { ps_id: string; ps_name: string; ps_code: string; amount: number }>;
  };

  const centerAgg = new Map<string, CenterAgg>();

  for (const [projectId, centerMap] of centerAllocByProject) {
    const totalAlloc = projectTotalAlloc.get(projectId) || 0;
    if (totalAlloc <= 0) continue;
    const projContracts = contractsByProject.get(projectId) || [];

    for (const [centerId, centerAlloc] of centerMap) {
      const ratio = centerAlloc / totalAlloc;
      const info = centerInfo.get(centerId)!;

      let agg = centerAgg.get(centerId);
      if (!agg) {
        agg = {
          center_id: centerId,
          center_name: info.name,
          center_code: info.code,
          total_revenue: 0,
          project_count: new Set(),
          by_product_service: new Map(),
        };
        centerAgg.set(centerId, agg);
      }

      for (const ct of projContracts) {
        const revenue = ratio * Number(ct.contract_value);
        agg.total_revenue += revenue;
        agg.project_count.add(projectId);

        const ps = ct.product_service as any;
        const psId = ct.product_service_id || "__none__";
        const psName = ps?.name || "Chưa phân loại";
        const psCode = ps?.code || "";

        let psAgg = agg.by_product_service.get(psId);
        if (!psAgg) {
          psAgg = { ps_id: psId, ps_name: psName, ps_code: psCode, amount: 0 };
          agg.by_product_service.set(psId, psAgg);
        }
        psAgg.amount += revenue;
      }
    }
  }

  const result = Array.from(centerAgg.values())
    .map((c) => ({
      center_id: c.center_id,
      center_name: c.center_name,
      center_code: c.center_code,
      total_revenue: Math.round(c.total_revenue),
      project_count: c.project_count.size,
      by_product_service: Array.from(c.by_product_service.values())
        .map((ps) => ({ ...ps, amount: Math.round(ps.amount) }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue);

  return jsonResponse(result);
}
