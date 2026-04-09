"use client";

import { KPIRing, VerdictBadge, UserAvatar, Section } from "@/components/shared";
import { ROLE_CONFIG, formatVND, getVerdict } from "@/lib/utils/kpi";
import type { Task, AllocationPeriod, AllocationResult } from "@/lib/types";


export function AllocationTable({
  period,
  results,
}: {
  period: AllocationPeriod;
  results: AllocationResult[];
}) {
  const sorted = [...results].sort((a, b) => b.weighted_score - a.weighted_score);
  const totalScore = sorted.reduce((s, r) => s + r.weighted_score, 0);

  return (
    <Section title={`💰 ${period.name}`}>
      <div className="p-3 flex items-center gap-4 text-sm border-b border-border bg-secondary/30">
        <span className="text-muted-foreground">Quỹ:</span>
        <span className="font-mono font-bold text-amber-400">{formatVND(period.total_fund)}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Chế độ:</span>
        <span className="font-semibold">{period.mode === "per_project" ? "Theo DA" : "Tổng hợp"}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Trạng thái:</span>
        <span className={`font-semibold ${period.status === "approved" ? "text-green-400" : period.status === "calculated" ? "text-amber-400" : "text-muted-foreground"}`}>
          {{ draft: "Nháp", calculated: "Đã tính", approved: "Đã duyệt", paid: "Đã chi", rejected: "Từ chối" }[period.status]}
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-secondary/50">
            {["#", "Mã HT", "Nhân viên", "Tasks", "Điểm KPI", "Tỷ lệ", "Sản lượng", "Lương đã ứng", "Thưởng khoán"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground border-b border-border">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const bonus = Number(r.bonus_amount ?? 0);
            const salary = Number(r.total_salary_paid ?? 0);
            const hasDeduction = !!r.deduction_id;
            const bonusDisplay = hasDeduction ? -(salary - r.allocated_amount) : bonus;
            return (
              <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/20">
                <td className="px-3 py-2 font-mono text-sm text-muted-foreground">#{i + 1}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{(r.user as any)?.employee_code || "—"}</td>
                <td className="px-3 py-2">
                  {r.user ? (
                    <div className="flex items-center gap-2">
                      <UserAvatar name={r.user.full_name} color={ROLE_CONFIG[r.user.role]?.color} size="xs" />
                      <span className="text-sm font-semibold">{r.user.full_name}</span>
                    </div>
                  ) : <span className="text-sm text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 font-mono text-sm">{r.task_count}</td>
                <td className="px-3 py-2 font-mono text-sm font-bold">{Math.round(r.weighted_score)}</td>
                <td className="px-3 py-2 font-mono text-sm text-muted-foreground">{(r.share_percentage * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 font-mono text-sm font-bold text-amber-400">{formatVND(r.allocated_amount)}</td>
                <td className="px-3 py-2 font-mono text-sm text-yellow-500">{salary > 0 ? formatVND(salary) : "—"}</td>
                <td className={`px-3 py-2 font-mono text-sm font-bold ${hasDeduction ? "text-red-500" : bonus > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                  {salary > 0 ? (bonusDisplay >= 0 ? `+${formatVND(bonusDisplay)}` : formatVND(bonusDisplay)) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-secondary/50 font-semibold">
            <td colSpan={6} className="px-3 py-2 text-sm text-right">Tổng</td>
            <td className="px-3 py-2 font-mono text-sm text-amber-400">{formatVND(period.total_fund)}</td>
            <td className="px-3 py-2 font-mono text-sm text-yellow-500">{formatVND(sorted.reduce((s, r) => s + Number(r.total_salary_paid ?? 0), 0))}</td>
            <td className="px-3 py-2 font-mono text-sm text-green-500">{formatVND(sorted.reduce((s, r) => s + Number(r.bonus_amount ?? 0), 0))}</td>
          </tr>
        </tfoot>
      </table>
    </Section>
  );
}


export function UserKPICard({
  user,
  tasks,
}: {
  user: { id: string; full_name: string; role: string; avatar_url?: string | null };
  tasks: Task[];
}) {
  const evaluated = tasks.filter((t) => t.kpi_evaluated_at);
  const totalWeight = tasks.reduce((s, t) => s + t.kpi_weight, 0);
  const avgE = totalWeight > 0 ? Math.round(tasks.reduce((s, t) => s + t.expect_score * t.kpi_weight, 0) / totalWeight) : 0;
  const avgA = evaluated.length > 0
    ? Math.round(evaluated.reduce((s, t) => s + t.actual_score * t.kpi_weight, 0) / evaluated.reduce((s, t) => s + t.kpi_weight, 0))
    : 0;
  const variance = avgA - avgE;
  const verdict = getVerdict(evaluated.length > 0 ? variance : null);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <UserAvatar name={user.full_name} color={ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG]?.color} size="md" />
        <div className="flex-1">
          <p className="text-base font-bold">{user.full_name}</p>
          <p className="text-[11px] text-muted-foreground">{tasks.length} tasks · {evaluated.length} đã đánh giá</p>
        </div>
        <VerdictBadge verdict={verdict} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <KPIRing score={avgE} size={44} strokeWidth={3} />
            <p className="text-[10px] text-muted-foreground mt-0.5">E</p>
          </div>
          {evaluated.length > 0 && (
            <>
              <span className="text-muted-foreground">→</span>
              <div className="text-center">
                <KPIRing score={avgA} size={44} strokeWidth={3} />
                <p className="text-[10px] text-muted-foreground mt-0.5">A</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-lg font-bold" style={{ color: variance >= 0 ? "#10b981" : "#ef4444" }}>
                  {variance >= 0 ? "+" : ""}{variance}
                </p>
                <p className="text-[10px] text-muted-foreground">Δ</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
