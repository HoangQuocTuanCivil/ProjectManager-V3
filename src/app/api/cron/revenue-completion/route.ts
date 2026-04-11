import { NextRequest } from "next/server";
import { verifyCronSecret, getAdminSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();

  const [contractsRes, tasksRes, existingRes] = await Promise.all([
    admin
      .from("contracts")
      .select("id, org_id, project_id, contract_value, status")
      .eq("status", "active")
      .is("deleted_at", null),
    admin
      .from("tasks")
      .select("project_id, progress")
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .not("project_id", "is", null),
    admin
      .from("revenue_entries")
      .select("contract_id, amount, description")
      .eq("method", "completion_rate")
      .eq("status", "confirmed"),
  ]);

  if (contractsRes.error) return errorResponse(contractsRes.error.message, 500);

  const tasksByProject = new Map<string, number[]>();
  for (const t of tasksRes.data ?? []) {
    if (!t.project_id) continue;
    const arr = tasksByProject.get(t.project_id) || [];
    arr.push(t.progress ?? 0);
    tasksByProject.set(t.project_id, arr);
  }

  const existingByContract = new Map<string, number>();
  // Trích xuất số lượng task từ các entry trước đó (lưu trong description)
  // để phát hiện khi task bị chuyển khỏi project gây negative delta giả
  const prevTaskCountByContract = new Map<string, number>();
  for (const e of existingRes.data ?? []) {
    if (!e.contract_id) continue;
    existingByContract.set(e.contract_id, (existingByContract.get(e.contract_id) || 0) + Number(e.amount));
    const match = (e as any).description?.match(/(\d+) tasks/);
    if (match) {
      const count = parseInt(match[1]);
      prevTaskCountByContract.set(
        e.contract_id,
        Math.max(prevTaskCountByContract.get(e.contract_id) || 0, count),
      );
    }
  }

  let created = 0;
  let skippedNegative = 0;

  for (const contract of contractsRes.data ?? []) {
    const progresses = tasksByProject.get(contract.project_id);
    if (!progresses || progresses.length === 0) continue;

    const avgProgress = progresses.reduce((s, p) => s + p, 0) / progresses.length;
    const expectedRevenue = Math.round((contract.contract_value * avgProgress) / 100);
    const existingTotal = existingByContract.get(contract.id) || 0;
    const delta = expectedRevenue - existingTotal;

    if (Math.abs(delta) < 1) continue;

    // Chặn negative delta khi nguyên nhân là task bị chuyển khỏi project.
    // So sánh số task hiện tại với số task ghi nhận trong entry trước đó:
    // nếu task count giảm → delta âm do mất task, không phải progress giảm thật.
    if (delta < 0) {
      const currentCount = progresses.length;
      const prevCount = prevTaskCountByContract.get(contract.id);
      if (prevCount !== undefined && currentCount < prevCount) {
        console.warn(
          `[revenue-completion] Skipped negative delta ${delta} for contract ${contract.id}` +
          ` (tasks: ${currentCount} current vs ${prevCount} previous — tasks removed from project)`,
        );
        skippedNegative++;
        continue;
      }
    }

    const { data: adminUser } = await admin
      .from("users")
      .select("id")
      .eq("org_id", contract.org_id)
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminUser) continue;

    const recognitionDate = new Date().toISOString().split("T")[0];
    const { data: entry } = await admin.from("revenue_entries").insert({
      org_id: contract.org_id,
      project_id: contract.project_id,
      contract_id: contract.id,
      dimension: "contract",
      method: "completion_rate",
      source: "manual",
      amount: delta,
      description: `Ghi nhận theo % hoàn thành (${Math.round(avgProgress)}%, ${progresses.length} tasks)`,
      recognition_date: recognitionDate,
      status: "confirmed",
      completion_percentage: Math.round(avgProgress * 100) / 100,
      period_start: recognitionDate,
      period_end: recognitionDate,
      created_by: adminUser.id,
    }).select("id").single();

    if (entry) {
      await admin.rpc("fn_allocate_dept_revenue", { p_entry_id: entry.id });
    }

    created++;
  }

  return jsonResponse({ success: true, created, skipped_negative: skippedNegative });
}
