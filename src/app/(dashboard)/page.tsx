"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { useAllocationPeriods } from "@/lib/hooks/use-kpi";
import { useCenters, useAllTeams } from "@/lib/hooks";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores";
import { useI18n } from "@/lib/i18n";
import {
  StatCard, Section, StatusBadge, PriorityBadge, ProgressBar, UserAvatar, KPIRing, Button, EmptyState,
} from "@/components/shared";
import { TaskListPanel, type StatPanelType } from "@/components/shared/task-list-panel";
import { ROLE_CONFIG, STATUS_CONFIG, formatDate, formatRelativeDate, formatVND, getVerdict, VERDICT_CONFIG } from "@/lib/utils/kpi";
import { useRouter } from "next/navigation";

const supabase = createClient();

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, code, center_id")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [statPanel, setStatPanel] = useState<StatPanelType>(null);
  const taskFilters = user?.role === "staff" ? { assignee_id: user.id } : {};
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(taskFilters);
  const { data: projects = [] } = useProjects();
  const { data: periods = [] } = useAllocationPeriods();
  const { data: centers = [] } = useCenters();
  const { data: departments = [] } = useDepartments();
  const { data: allTeams = [] } = useAllTeams();

  const [kpiGroupBy, setKpiGroupBy] = useState<"center" | "department" | "team">("center");
  const [kpiFilterId, setKpiFilterId] = useState("all");

  const activeTasks = tasks.filter((t) => !["completed", "cancelled"].includes(t.status));
  const overdue = tasks.filter((t) => t.status === "overdue");
  const review = tasks.filter((t) => t.status === "review");
  const evaluated = tasks.filter((t) => t.kpi_evaluated_at);
  const totalWeight = tasks.reduce((s, t) => s + t.kpi_weight, 0);
  const avgKPI = totalWeight > 0
    ? Math.round(tasks.reduce((s, t) => s + t.expect_score * t.kpi_weight, 0) / totalWeight)
    : 0;

  // KPI Quick: scoped by user role
  const scopedTasks = useMemo(() => {
    if (!user) return tasks;
    switch (user.role) {
      case "director":
        return user.center_id
          ? tasks.filter((t) => t.department?.center_id === user.center_id)
          : tasks;
      case "head":
        return user.dept_id
          ? tasks.filter((t) => t.dept_id === user.dept_id)
          : tasks;
      case "team_leader":
        return user.team_id
          ? tasks.filter((t) => t.team_id === user.team_id)
          : tasks;
      case "staff":
        return tasks.filter((t) => t.assignee_id === user.id);
      default: // admin, leader
        return tasks;
    }
  }, [tasks, user]);

  const scopedEvaluated = scopedTasks.filter((t) => t.kpi_evaluated_at);
  const scopedReview = scopedTasks.filter((t) => t.status === "review");
  const scopedOverdue = scopedTasks.filter((t) => t.status === "overdue");
  const scopedWeight = scopedTasks.reduce((s, t) => s + t.kpi_weight, 0);
  const scopedAvgKPI = scopedWeight > 0
    ? Math.round(scopedTasks.reduce((s, t) => s + t.expect_score * t.kpi_weight, 0) / scopedWeight)
    : 0;
  // Recent tasks: sorted by deadline ascending (nearest due first)
  const recentTasks = [...tasks]
    .filter((t) => t.assignee_id === user?.id || t.assigner_id === user?.id)
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 8);
  // Active projects: sorted by end_date ascending (nearest due first)
  const activeProjects = projects
    .filter((p) => p.status === "active")
    .sort((a, b) => {
      const da = a.end_date ? new Date(a.end_date).getTime() : Infinity;
      const db = b.end_date ? new Date(b.end_date).getTime() : Infinity;
      return da - db;
    });

  // KPI ranking: aggregate weighted average score per user
  const kpiRanking = useMemo(() => {
    const userMap = new Map<string, {
      id: string; name: string; avatar: string | null; role: string;
      deptId: string | null; centerId: string | null; teamId: string | null;
      totalWeight: number; weightedScore: number;
    }>();

    for (const task of tasks) {
      if (!task.assignee_id || !task.assignee) continue;
      const score = task.actual_score ?? task.expect_score ?? 0;
      const weight = task.kpi_weight || 0;
      if (weight === 0) continue;

      if (!userMap.has(task.assignee_id)) {
        userMap.set(task.assignee_id, {
          id: task.assignee_id,
          name: task.assignee.full_name,
          avatar: task.assignee.avatar_url ?? null,
          role: task.assignee.role,
          deptId: task.dept_id ?? null,
          centerId: task.department?.center_id ?? null,
          teamId: task.team_id ?? null,
          totalWeight: 0,
          weightedScore: 0,
        });
      }
      const entry = userMap.get(task.assignee_id)!;
      entry.totalWeight += weight;
      entry.weightedScore += score * weight;
    }

    return Array.from(userMap.values())
      .map((u) => ({
        ...u,
        score: u.totalWeight > 0 ? Math.round(u.weightedScore / u.totalWeight) : 0,
      }))
      .filter((u) => {
        if (kpiFilterId === "all") return true;
        if (kpiGroupBy === "center") return u.centerId === kpiFilterId;
        if (kpiGroupBy === "department") return u.deptId === kpiFilterId;
        return u.teamId === kpiFilterId;
      })
      .sort((a, b) => b.score - a.score);
  }, [tasks, kpiGroupBy, kpiFilterId]);

  // Filter options based on groupBy mode
  const kpiFilterOptions = useMemo(() => {
    if (kpiGroupBy === "center") {
      return centers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
    }
    if (kpiGroupBy === "department") {
      return departments.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
    }
    return allTeams.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }));
  }, [kpiGroupBy, centers, departments, allTeams]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold">
          {t.dashboard.greeting}, {user?.full_name?.split(" ").pop() || "bạn"}
        </h1>
        <p className="text-base text-muted-foreground mt-0.5">
          {t.dashboard.subtitle}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={t.dashboard.totalTasks}
          value={tasks.length}
          subtitle={`${activeTasks.length} ${t.dashboard.processing}`}
          accentColor="hsl(var(--primary))"
          onClick={() => setStatPanel("total")}
          onSubtitleClick={() => setStatPanel("processing")}
        />
        <StatCard
          label={t.dashboard.inProgress}
          value={tasks.filter((t) => t.status === "in_progress").length}
          subtitle={`${review.length} ${t.dashboard.pendingReview}`}
          accentColor="#3b82f6"
          onClick={() => setStatPanel("in_progress")}
          onSubtitleClick={() => setStatPanel("review")}
        />
        <StatCard
          label={t.dashboard.overdueCard}
          value={overdue.length}
          subtitle={overdue.length > 0 ? t.dashboard.needAction : t.dashboard.noOverdue}
          accentColor="#ef4444"
          onClick={() => setStatPanel("overdue")}
        />
        <StatCard
          label={t.dashboard.avgKpiExpected}
          value={avgKPI}
          subtitle={`${evaluated.length}/${tasks.length} ${t.dashboard.evaluated}`}
          accentColor="#10b981"
        />
      </div>

      {/* Main content: 4 columns aligned with stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[calc(100vh-320px)]">
        {/* Công việc gần đây — span 2 cols (aligned under Tổng công việc + Đang làm) */}
        <Section
          title={t.dashboard.recentTasks}
          action={
            <button onClick={() => router.push("/tasks")} className="text-sm text-primary hover:underline">
              {t.common.viewAll} →
            </button>
          }
          className="md:col-span-2"
        >
          {tasksLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentTasks.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t.dashboard.noTasks} subtitle={t.dashboard.noTasksSub} />
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => router.push("/tasks")}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {task.project && (
                        <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {task.project.code}
                        </span>
                      )}
                      <span className="text-sm font-medium truncate">{task.title}</span>
                    </div>
                  </div>
                  <StatusBadge status={task.status} />
                  <ProgressBar value={task.progress} className="hidden md:flex" />
                  {task.assignee && (
                    <UserAvatar name={task.assignee.full_name} color={ROLE_CONFIG[task.assignee.role]?.color} size="xs" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Xếp hạng KPI + KPI nhanh — 1 col (aligned under Quá hạn) */}
        <div className="flex flex-col gap-4">
          <Section
            title={t.dashboard.kpiRanking}
            action={
              <button onClick={() => router.push("/kpi")} className="text-sm text-primary hover:underline">
                {t.common.viewAll} →
              </button>
            }
            className="flex-1"
          >
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/40">
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                <button
                  onClick={() => { setKpiGroupBy("center"); setKpiFilterId("all"); }}
                  className={`px-2.5 py-1 transition-colors ${kpiGroupBy === "center" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                >
                  {t.dashboard.kpiRankingCenter}
                </button>
                <button
                  onClick={() => { setKpiGroupBy("department"); setKpiFilterId("all"); }}
                  className={`px-2.5 py-1 transition-colors ${kpiGroupBy === "department" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                >
                  {t.dashboard.kpiRankingDept}
                </button>
                <button
                  onClick={() => { setKpiGroupBy("team"); setKpiFilterId("all"); }}
                  className={`px-2.5 py-1 transition-colors ${kpiGroupBy === "team" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                >
                  {t.dashboard.kpiRankingTeam}
                </button>
              </div>
              <select
                value={kpiFilterId}
                onChange={(e) => setKpiFilterId(e.target.value)}
                className="flex-1 text-xs bg-secondary border border-border rounded-lg px-2 py-1 outline-none"
              >
                <option value="all">{t.dashboard.kpiRankingAll}</option>
                {kpiFilterOptions.map((opt: { id: string; name: string }) => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>

            {kpiRanking.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t.dashboard.kpiRankingEmpty} />
              </div>
            ) : (
              <div className="divide-y divide-border/40 max-h-[420px] overflow-y-auto">
                {kpiRanking.map((item, idx) => {
                  const scoreColor = item.score >= 80 ? "text-green-500" : item.score >= 50 ? "text-amber-500" : "text-red-500";
                  return (
                    <div key={item.id} className="flex items-center gap-2.5 px-4 py-2 hover:bg-secondary/30 transition-colors">
                      <span className="w-6 text-center text-xs font-mono text-muted-foreground shrink-0">
                        {idx + 1}
                      </span>
                      <UserAvatar
                        name={item.name}
                        src={item.avatar}
                        color={ROLE_CONFIG[item.role as keyof typeof ROLE_CONFIG]?.color}
                        size="xs"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                      </div>
                      <span className={`text-sm font-mono font-bold ${scoreColor}`}>
                        {item.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title={t.dashboard.kpiQuick}>
            <div className="p-6 flex items-center justify-center gap-8">
              <div className="text-center">
                <KPIRing score={scopedAvgKPI} size={96} strokeWidth={6} />
                <p className="text-xs text-muted-foreground mt-2">{t.dashboard.kpiAvg}</p>
              </div>
              <div className="space-y-2.5 text-sm">
                <button
                  onClick={() => setStatPanel("evaluated")}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">{t.dashboard.evaluatedLabel}</span>
                  <span className="font-mono font-semibold">{scopedEvaluated.length}</span>
                </button>
                <button
                  onClick={() => setStatPanel("review")}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">{t.dashboard.pendingLabel}</span>
                  <span className="font-mono font-semibold">{scopedReview.length}</span>
                </button>
                <button
                  onClick={() => setStatPanel("overdue")}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">{t.dashboard.overdueLabel}</span>
                  <span className="font-mono font-semibold">{scopedOverdue.length}</span>
                </button>
              </div>
            </div>
          </Section>
        </div>

        {/* Dự án đang triển khai + Khoán — 1 col (aligned under KPI TB kỳ vọng) */}
        <div className="flex flex-col gap-4">
          <Section
            title={t.dashboard.activeProjects}
            action={
              <button onClick={() => router.push("/projects")} className="text-sm text-primary hover:underline">
                {t.common.viewAll} →
              </button>
            }
            className="flex-1"
          >
            <div className="p-3 space-y-2">
              {activeProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t.dashboard.noProjects}</p>
              ) : (
                activeProjects.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="w-8 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary font-mono">
                      {p.code?.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.code}</p>
                    </div>
                    <ProgressBar value={p.progress ?? 0} showText={false} className="w-16" />
                  </div>
                ))
              )}
            </div>
          </Section>

          {/* Latest Allocation - ẩn với staff */}
          {periods.length > 0 && user?.role !== "staff" && (
            <Section
              title={t.dashboard.recentAllocation}
              action={
                <button onClick={() => router.push("/kpi")} className="text-sm text-primary hover:underline">
                  {t.common.detail} →
                </button>
              }
            >
              <div className="p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{periods[0].name}</span>
                  <span className="font-mono text-amber-500 font-bold">{formatVND(periods[0].total_fund)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formatDate(periods[0].period_start)} → {formatDate(periods[0].period_end)}
                </p>
                <div className="mt-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                    periods[0].status === "approved" ? "bg-green-500/10 text-green-500"
                    : periods[0].status === "calculated" ? "bg-amber-500/10 text-amber-500"
                    : "bg-secondary text-muted-foreground"
                  }`}>
                    {{ draft: t.dashboard.draft, calculated: t.dashboard.calculated, approved: t.dashboard.approved, paid: t.dashboard.paid, rejected: t.dashboard.rejected }[periods[0].status]}
                  </span>
                </div>
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* Floating task panel for stat cards */}
      <TaskListPanel
        open={statPanel !== null}
        onOpenChange={(open) => { if (!open) setStatPanel(null); }}
        panelType={statPanel}
        tasks={tasks}
      />
    </div>
  );
}
