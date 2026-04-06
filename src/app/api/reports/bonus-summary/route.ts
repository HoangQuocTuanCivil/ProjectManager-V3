import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

// Báo cáo thưởng khoán tổng hợp: theo kỳ, theo PB, top/bottom performers.
// Dữ liệu từ view v_employee_bonus.
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const period_id = searchParams.get("period_id");

  let query = supabase.from("v_employee_bonus").select("*");
  if (period_id) query = query.eq("period_id", period_id);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  const rows = data ?? [];

  // Tổng hợp theo phòng ban
  const byDept = new Map<string, { dept_name: string; total_alloc: number; total_salary: number; total_bonus: number; total_deduction: number; count: number }>();
  for (const r of rows) {
    const key = r.dept_id || "none";
    const existing = byDept.get(key) || { dept_name: r.dept_name || "—", total_alloc: 0, total_salary: 0, total_bonus: 0, total_deduction: 0, count: 0 };
    existing.total_alloc += Number(r.allocated_amount);
    existing.total_salary += Number(r.total_salary);
    existing.total_bonus += Number(r.bonus_amount);
    existing.total_deduction += Number(r.deduction_remaining);
    existing.count++;
    byDept.set(key, existing);
  }

  // Top/bottom performers
  const sorted = [...rows].sort((a, b) => Number(b.bonus_amount) - Number(a.bonus_amount));
  const topPerformers = sorted.slice(0, 5).map(r => ({
    full_name: r.full_name, dept_name: r.dept_name,
    allocated_amount: r.allocated_amount, bonus_amount: r.bonus_amount,
  }));
  const bottomPerformers = sorted.slice(-5).reverse().filter(r => Number(r.bonus_amount) === 0 || r.outcome === "deduction").map(r => ({
    full_name: r.full_name, dept_name: r.dept_name,
    allocated_amount: r.allocated_amount, deduction_remaining: r.deduction_remaining,
  }));

  return jsonResponse({
    total_employees: rows.length,
    total_bonus: rows.reduce((s, r) => s + Number(r.bonus_amount), 0),
    total_deduction: rows.filter(r => r.outcome === "deduction").reduce((s, r) => s + Number(r.deduction_remaining), 0),
    bonus_count: rows.filter(r => r.outcome === "bonus").length,
    deduction_count: rows.filter(r => r.outcome === "deduction").length,
    byDept: Array.from(byDept.entries()).map(([k, v]) => ({ dept_id: k, ...v })),
    topPerformers,
    bottomPerformers,
  });
}
