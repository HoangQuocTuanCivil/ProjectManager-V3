"use client";

import { useParams } from "next/navigation";
import { useTasks } from "@/features/tasks";
import { useAllocationPeriods } from "@/features/kpi";
import { Section, StatCard, UserAvatar, KPIRing, EmptyState } from "@/components/shared";
import { User, Coins } from "lucide-react";
import { AllocationTable } from "@/features/kpi";
import { ROLE_CONFIG, formatVND } from "@/lib/utils/kpi";
import type { Task, AllocationPeriod } from "@/lib/types";

export default function ProjectAllocationPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: tasks = [] } = useTasks({ project_id: projectId });
  const { data: allPeriods = [] } = useAllocationPeriods();

  // Filter periods for this project
  const periods = allPeriods.filter((p) => p.project_id === projectId || p.mode === "global");
  const evaluated = tasks.filter((t) => t.kpi_evaluated_at);

  // Build user KPI summary from tasks
  const userMap = new Map<string, { name: string; role: string; tasks: number; avgE: number; avgA: number; totalWeight: number }>();
  tasks.forEach((t) => {
    if (!t.assignee_id || !t.assignee) return;
    const existing = userMap.get(t.assignee_id) || {
      name: t.assignee.full_name, role: t.assignee.role, tasks: 0, avgE: 0, avgA: 0, totalWeight: 0,
    };
    existing.tasks++;
    existing.avgE += t.expect_score * t.kpi_weight;
    if (t.kpi_evaluated_at) existing.avgA += t.actual_score * t.kpi_weight;
    existing.totalWeight += t.kpi_weight;
    userMap.set(t.assignee_id, existing);
  });

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Tổng sản phẩm" value={tasks.length} accentColor="hsl(var(--primary))" />
        <StatCard label="Đã nghiệm thu" value={evaluated.length} accentColor="#10b981" />
        <StatCard label="Đợt khoán" value={periods.length} accentColor="#f59e0b" />
      </div>

      {/* User KPI Summary */}
      <Section title="KPI theo người thực hiện">
        {userMap.size === 0 ? (
          <div className="p-6">
            <EmptyState icon={<User size={32} strokeWidth={1.5} />} title="Chưa có dữ liệu" subtitle="Giao việc cho nhân viên để bắt đầu" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Nhân viên", "Tasks", "KPI E (TB)", "KPI A (TB)", "Δ"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(userMap.entries()).map(([userId, data]) => {
                  const avgE = data.totalWeight > 0 ? Math.round(data.avgE / data.totalWeight) : 0;
                  const avgA = data.totalWeight > 0 ? Math.round(data.avgA / data.totalWeight) : 0;
                  const delta = avgA - avgE;
                  return (
                    <tr key={userId} className="border-b border-border/40">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={data.name} color={ROLE_CONFIG[data.role as keyof typeof ROLE_CONFIG]?.color} size="sm" />
                          <div>
                            <p className="text-base font-semibold">{data.name}</p>
                            <p className="text-[11px] text-muted-foreground">{ROLE_CONFIG[data.role as keyof typeof ROLE_CONFIG]?.label}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm">{data.tasks}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <KPIRing score={avgE} size={28} strokeWidth={2.5} />
                          <span className="font-mono text-sm">{avgE}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <KPIRing score={avgA} size={28} strokeWidth={2.5} />
                          <span className="font-mono text-sm font-bold">{avgA || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {avgA > 0 ? (
                          <span className="font-mono text-sm font-bold" style={{ color: delta >= 0 ? "#10b981" : "#ef4444" }}>
                            {delta >= 0 ? "+" : ""}{delta}
                          </span>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Allocation Periods */}
      {periods.length > 0 ? (
        <div className="space-y-4">
          {periods.map((period) => (
            <AllocationTable key={period.id} period={period} results={period.results || []} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Coins size={32} strokeWidth={1.5} />} title="Chưa có khoán" subtitle="Tạo đợt khoán từ trang KPI & Chia khoán" />
      )}
    </div>
  );
}
