"use client";

import { useState } from "react";
import { useTasks } from "@/features/tasks";
import { useProjects } from "@/features/projects";
import { useUsers } from "@/features/organization";
import { StatCard, Section, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { UserKPICard } from "@/features/kpi";
import { VERDICT_CONFIG, getVerdict } from "@/lib/utils/kpi";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";

/**
 * KPI Overview page — displays aggregate KPI statistics, verdict distribution,
 * and per-employee KPI cards. Filterable by project.
 */
export default function KPIOverviewPage() {
  const { t } = useI18n();
  const { data: tasks = [] } = useTasks({});
  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();
  const [projectFilter, setProjectFilter] = useState("all");

  const filteredTasks = projectFilter === "all" ? tasks : tasks.filter((tk) => tk.project_id === projectFilter);
  const evaluated = filteredTasks.filter((tk) => tk.kpi_evaluated_at);
  const totalWeight = filteredTasks.reduce((s, tk) => s + tk.kpi_weight, 0);
  const avgE = totalWeight > 0
    ? Math.round(filteredTasks.reduce((s, tk) => s + tk.expect_score * tk.kpi_weight, 0) / totalWeight)
    : 0;
  const avgA = evaluated.length > 0
    ? Math.round(evaluated.reduce((s, tk) => s + tk.actual_score * tk.kpi_weight, 0) / evaluated.reduce((s, tk) => s + tk.kpi_weight, 0))
    : 0;

  // Group tasks by assignee for per-employee KPI cards
  const userTaskMap = new Map<string, Task[]>();
  filteredTasks.forEach((tk) => {
    if (tk.assignee_id) {
      const arr = userTaskMap.get(tk.assignee_id) || [];
      arr.push(tk);
      userTaskMap.set(tk.assignee_id, arr);
    }
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Project Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground font-medium">{t.common.filterByProject}</span>
        <SearchSelect
          value={projectFilter}
          onChange={setProjectFilter}
          options={[
            { value: "all", label: t.common.allProjects },
            ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
          ]}
          placeholder={t.common.selectProject}
          className="mt-1"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t.kpi.totalTasks} value={filteredTasks.length} accentColor="hsl(var(--primary))" />
        <StatCard label={t.kpi.evaluated} value={evaluated.length} subtitle={`${tasks.length > 0 ? Math.round((evaluated.length / tasks.length) * 100) : 0}%`} accentColor="#10b981" />
        <StatCard label={t.kpi.avgExpected} value={avgE} accentColor="hsl(var(--primary))" />
        <StatCard
          label={t.kpi.avgActual}
          value={evaluated.length > 0 ? avgA : "—"}
          subtitle={evaluated.length > 0 ? `Δ ${avgA - avgE >= 0 ? "+" : ""}${avgA - avgE}` : t.common.noData}
          accentColor={avgA >= avgE ? "#10b981" : "#ef4444"}
        />
      </div>

      {/* Verdict Distribution */}
      <Section title={t.kpi.distribution}>
        <div className="p-4">
          {evaluated.length === 0 ? (
            <p className="text-base text-muted-foreground text-center py-4">{t.kpi.noEvaluated}</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {(["exceptional", "exceeded", "near_target", "below_target"] as const).map((v) => {
                const count = evaluated.filter((tk) => getVerdict(tk.kpi_variance) === v).length;
                const pct = evaluated.length > 0 ? Math.round((count / evaluated.length) * 100) : 0;
                const cfg = VERDICT_CONFIG[v];
                const verdictLabel = {
                  exceptional: t.kpi.exceptionalFull,
                  exceeded: t.kpi.exceededFull,
                  near_target: t.kpi.nearTargetFull,
                  below_target: t.kpi.belowTargetFull,
                }[v];
                return (
                  <div key={v} className="text-center p-3 rounded-xl bg-secondary/50">
                    <p className="text-2xl font-bold font-mono" style={{ color: cfg.color }}>{count}</p>
                    <p className="text-xs font-medium mt-0.5" style={{ color: cfg.color }}>{verdictLabel}</p>
                    <p className="text-[11px] text-muted-foreground">{pct}%</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Section>

      {/* User KPI Cards */}
      <Section title={t.kpi.byEmployee}>
        <div className="p-4">
          {userTaskMap.size === 0 ? (
            <p className="text-base text-muted-foreground text-center py-4">{t.common.noData}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(userTaskMap.entries()).map(([userId, userTasks]) => {
                const u = users.find((u: any) => u.id === userId);
                if (!u) return null;
                return (
                  <UserKPICard
                    key={userId}
                    user={{ id: u.id, full_name: u.full_name, role: u.role, avatar_url: u.avatar_url }}
                    tasks={userTasks}
                  />
                );
              })}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
