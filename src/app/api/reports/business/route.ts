import { NextRequest } from "next/server";
import { getAuthProfile, getUntypedAdmin, jsonResponse, errorResponse } from "@/lib/api/helpers";

type GroupBy = "company" | "center" | "department" | "product_service";

type Filters = {
  centerId?: string | null;
  deptId?: string | null;
  from?: string | null;
  to?: string | null;
};

type CostBucket = { cogs: number; selling: number; admin: number; financial: number };

type Admin = ReturnType<typeof getUntypedAdmin>;

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const admin = getUntypedAdmin();
  const sp = new URL(req.url).searchParams;
  const groupBy = (sp.get("group_by") || "company") as GroupBy;
  const filters: Filters = {
    centerId: sp.get("center_id"),
    deptId: sp.get("dept_id"),
    from: sp.get("from"),
    to: sp.get("to"),
  };
  const orgId = profile.org_id;

  const [revenueMap, costsMap, salaryMap, incomingMap, centersRes, deptsRes, psRes] =
    await Promise.all([
      fetchRevenue(admin, orgId, groupBy, filters),
      fetchCosts(admin, orgId, groupBy, filters),
      fetchSalary(admin, orgId, groupBy, filters),
      fetchIncomingContracts(admin, orgId, groupBy, filters),
      admin.from("centers").select("id, name, code").eq("org_id", orgId).eq("is_active", true),
      admin.from("departments").select("id, name, code, center_id").eq("org_id", orgId).eq("is_active", true),
      admin.from("product_services").select("id, name, code").eq("org_id", orgId).eq("is_active", true),
    ]);

  const allKeys = new Set([
    ...revenueMap.keys(),
    ...costsMap.keys(),
    ...salaryMap.keys(),
    ...incomingMap.keys(),
  ]);

  const resolve = buildNameResolver(groupBy, centersRes.data ?? [], deptsRes.data ?? [], psRes.data ?? [], orgId);

  const rows: any[] = [];
  for (const key of allKeys) {
    const resolved = resolve(key);
    if (!resolved) continue;

    const revenue = revenueMap.get(key) ?? 0;
    const costs = costsMap.get(key) ?? { cogs: 0, selling: 0, admin: 0, financial: 0 };
    const salary = salaryMap.get(key) ?? 0;
    const incoming = incomingMap.get(key) ?? 0;
    const totalCost = costs.cogs + costs.selling + costs.admin + costs.financial + salary + incoming;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

    rows.push({
      id: key,
      name: resolved.name,
      code: resolved.code,
      revenue,
      cogs: costs.cogs,
      selling: costs.selling,
      admin: costs.admin,
      financial: costs.financial,
      salary,
      incoming,
      total_cost: totalCost,
      profit,
      margin,
    });
  }

  rows.sort((a, b) => b.revenue - a.revenue);

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      cogs: acc.cogs + r.cogs,
      selling: acc.selling + r.selling,
      admin: acc.admin + r.admin,
      financial: acc.financial + r.financial,
      salary: acc.salary + r.salary,
      incoming: acc.incoming + r.incoming,
      total_cost: acc.total_cost + r.total_cost,
      profit: acc.profit + r.profit,
    }),
    { revenue: 0, cogs: 0, selling: 0, admin: 0, financial: 0, salary: 0, incoming: 0, total_cost: 0, profit: 0 },
  );

  const totalMargin = totals.revenue > 0
    ? Math.round((totals.profit / totals.revenue) * 1000) / 10
    : 0;

  return jsonResponse({ rows, totals: { ...totals, margin: totalMargin } });
}

async function fetchRevenue(admin: Admin, orgId: string, groupBy: GroupBy, f: Filters) {
  const map = new Map<string, number>();

  if (groupBy === "product_service") {
    let q = admin.from("revenue_entries")
      .select("product_service_id, amount")
      .eq("org_id", orgId).eq("status", "confirmed")
      .not("product_service_id", "is", null);
    if (f.from) q = q.gte("recognition_date", f.from);
    if (f.to) q = q.lte("recognition_date", f.to);
    const { data } = await q;
    for (const r of data ?? []) {
      map.set(r.product_service_id, (map.get(r.product_service_id) ?? 0) + Number(r.amount));
    }
    return map;
  }

  if (groupBy === "company") {
    let q = admin.from("revenue_entries")
      .select("amount").eq("org_id", orgId).eq("status", "confirmed");
    if (f.from) q = q.gte("recognition_date", f.from);
    if (f.to) q = q.lte("recognition_date", f.to);
    const { data } = await q;
    let total = 0;
    for (const r of data ?? []) total += Number(r.amount);
    map.set(orgId, total);
    return map;
  }

  const { data } = await admin.from("dept_revenue_allocations")
    .select("dept_id, allocated_amount, department:departments(center_id), revenue_entry:revenue_entries(recognition_date, status, org_id)");

  for (const row of data ?? []) {
    const entry = row.revenue_entry as any;
    const dept = row.department as any;
    if (!entry || entry.status !== "confirmed" || entry.org_id !== orgId) continue;
    if (f.from && entry.recognition_date < f.from) continue;
    if (f.to && entry.recognition_date > f.to) continue;

    if (groupBy === "center") {
      if (!dept?.center_id) continue;
      if (f.centerId && dept.center_id !== f.centerId) continue;
      map.set(dept.center_id, (map.get(dept.center_id) ?? 0) + Number(row.allocated_amount));
    } else {
      if (f.centerId && dept?.center_id !== f.centerId) continue;
      if (f.deptId && row.dept_id !== f.deptId) continue;
      map.set(row.dept_id, (map.get(row.dept_id) ?? 0) + Number(row.allocated_amount));
    }
  }
  return map;
}

async function fetchCosts(admin: Admin, orgId: string, groupBy: GroupBy, f: Filters) {
  const map = new Map<string, CostBucket>();
  const empty = (): CostBucket => ({ cogs: 0, selling: 0, admin: 0, financial: 0 });

  let q = admin.from("cost_entries")
    .select("dept_id, contract_id, category, amount, project_id")
    .eq("org_id", orgId);
  if (f.from) q = q.gte("period_start", f.from);
  if (f.to) q = q.lte("period_end", f.to);
  const { data } = await q;

  if (groupBy === "company") {
    const bucket = empty();
    for (const r of data ?? []) {
      const cat = r.category as keyof CostBucket;
      if (cat in bucket) bucket[cat] += Number(r.amount);
    }
    map.set(orgId, bucket);
    return map;
  }

  if (groupBy === "product_service") {
    const { data: contracts } = await admin.from("contracts")
      .select("id, project:projects(product_service_ids)").eq("org_id", orgId);
    const cps = new Map<string, string[]>();
    for (const c of contracts ?? []) {
      const proj = c.project as any;
      if (proj?.product_service_ids?.length) cps.set(c.id, proj.product_service_ids);
    }
    for (const r of data ?? []) {
      const cat = r.category as keyof CostBucket;
      const psIds = (r.contract_id && cps.get(r.contract_id)) || [];
      if (!psIds.length) continue;
      const share = Number(r.amount) / psIds.length;
      for (const psId of psIds) {
        const bucket = map.get(psId) ?? empty();
        if (cat in bucket) bucket[cat] += share;
        map.set(psId, bucket);
      }
    }
    return map;
  }

  const deptCenter = await buildDeptCenterMap(admin, orgId);
  for (const r of data ?? []) {
    if (!r.dept_id) continue;
    const cat = r.category as keyof CostBucket;
    const key = resolveGroupKey(groupBy, r.dept_id, deptCenter, f);
    if (!key) continue;
    const bucket = map.get(key) ?? empty();
    if (cat in bucket) bucket[cat] += Number(r.amount);
    map.set(key, bucket);
  }
  return map;
}

async function fetchSalary(admin: Admin, orgId: string, groupBy: GroupBy, f: Filters) {
  const map = new Map<string, number>();

  let q = admin.from("salary_records")
    .select("dept_id, base_salary").eq("org_id", orgId);
  if (f.from) q = q.gte("month", f.from);
  if (f.to) q = q.lte("month", f.to);
  const { data } = await q;

  if (groupBy === "company") {
    let total = 0;
    for (const r of data ?? []) total += Number(r.base_salary);
    map.set(orgId, total);
    return map;
  }

  if (groupBy === "product_service") return map;

  const deptCenter = await buildDeptCenterMap(admin, orgId);
  for (const r of data ?? []) {
    if (!r.dept_id) continue;
    const key = resolveGroupKey(groupBy, r.dept_id, deptCenter, f);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + Number(r.base_salary));
  }
  return map;
}

async function fetchIncomingContracts(admin: Admin, orgId: string, groupBy: GroupBy, f: Filters) {
  const map = new Map<string, number>();

  let q = admin.from("contracts")
    .select("id, contract_value, project_id, project:projects(product_service_ids)")
    .eq("org_id", orgId)
    .eq("contract_type", "incoming")
    .in("status", ["active", "completed"]);
  if (f.from) q = q.gte("signed_date", f.from);
  if (f.to) q = q.lte("signed_date", f.to);

  const { data: contracts } = await q;
  if (!contracts?.length) return map;

  if (groupBy === "company") {
    let total = 0;
    for (const c of contracts) total += Number(c.contract_value);
    map.set(orgId, total);
    return map;
  }

  if (groupBy === "product_service") {
    for (const c of contracts) {
      const psIds: string[] = (c.project as any)?.product_service_ids ?? [];
      if (!psIds.length) continue;
      const share = Number(c.contract_value) / psIds.length;
      for (const psId of psIds) map.set(psId, (map.get(psId) ?? 0) + share);
    }
    return map;
  }

  const contractIds = contracts.map((c) => c.id);
  const { data: allocs } = await admin.from("dept_budget_allocations")
    .select("contract_id, dept_id, center_id")
    .in("contract_id", contractIds);

  const allocMap = new Map<string, { dept_id: string | null; center_id: string | null }>();
  for (const a of allocs ?? []) {
    if (a.contract_id) allocMap.set(a.contract_id, { dept_id: a.dept_id, center_id: a.center_id });
  }

  for (const c of contracts) {
    const alloc = allocMap.get(c.id);
    if (!alloc) continue;
    const amount = Number(c.contract_value);

    if (groupBy === "center") {
      const cid = alloc.center_id;
      if (!cid) continue;
      if (f.centerId && cid !== f.centerId) continue;
      map.set(cid, (map.get(cid) ?? 0) + amount);
    } else {
      if (f.centerId && alloc.center_id !== f.centerId) continue;
      if (f.deptId && alloc.dept_id !== f.deptId) continue;
      const key = alloc.dept_id || alloc.center_id;
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + amount);
    }
  }
  return map;
}

async function buildDeptCenterMap(admin: Admin, orgId: string) {
  const { data } = await admin.from("departments")
    .select("id, center_id").eq("org_id", orgId).eq("is_active", true);
  return new Map((data ?? []).map((d: any) => [d.id, d.center_id as string]));
}

function resolveGroupKey(
  groupBy: GroupBy,
  deptId: string,
  deptCenter: Map<string, string>,
  f: Filters,
): string | null {
  if (groupBy === "center") {
    const cid = deptCenter.get(deptId);
    if (!cid) return null;
    if (f.centerId && cid !== f.centerId) return null;
    return cid;
  }
  if (f.centerId) {
    const cid = deptCenter.get(deptId);
    if (cid !== f.centerId) return null;
  }
  if (f.deptId && deptId !== f.deptId) return null;
  return deptId;
}

function buildNameResolver(
  groupBy: GroupBy,
  centers: Array<{ id: string; name: string; code: string }>,
  depts: Array<{ id: string; name: string; code: string; center_id: string }>,
  ps: Array<{ id: string; name: string; code: string }>,
  orgId: string,
) {
  const cMap = new Map(centers.map((c) => [c.id, c]));
  const dMap = new Map(depts.map((d) => [d.id, d]));
  const pMap = new Map(ps.map((p) => [p.id, p]));

  return (key: string): { name: string; code: string } | null => {
    if (groupBy === "company") return { name: "Toàn công ty", code: "ALL" };
    if (groupBy === "center") { const c = cMap.get(key); return c ? { name: c.name, code: c.code } : null; }
    if (groupBy === "department") { const d = dMap.get(key); return d ? { name: d.name, code: d.code } : null; }
    if (groupBy === "product_service") { const p = pMap.get(key); return p ? { name: p.name, code: p.code } : null; }
    return null;
  };
}
