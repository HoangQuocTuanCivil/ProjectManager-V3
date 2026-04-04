"use client";

import { useState } from "react";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { useAllocationPeriods } from "@/lib/hooks/use-kpi";
import { useAuthStore } from "@/lib/stores";
import { useI18n } from "@/lib/i18n";
import {
  StatCard, Section, StatusBadge, PriorityBadge, ProgressBar, UserAvatar, KPIRing, Button, EmptyState,
} from "@/components/shared";
import { TaskListPanel, type StatPanelType } from "@/components/shared/task-list-panel";
import { ROLE_CONFIG, STATUS_CONFIG, formatDate, formatRelativeDate, formatVND, getVerdict, VERDICT_CONFIG } from "@/lib/utils/kpi";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [statPanel, setStatPanel] = useState<StatPanelType>(null);
  const taskFilters = user?.role === "staff" ? { assignee_id: user.id } : {};
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(taskFilters);
  const { data: projects = [] } = useProjects();
  const { data: periods = [] } = useAllocationPeriods();

  const activeTasks = tasks.filter((t) => !["completed", "cancelled"].includes(t.status));
  const overdue = tasks.filter((t) => t.status === "overdue");
  const review = tasks.filter((t) => t.status === "review");
  const evaluated = tasks.filter((t) => t.kpi_evaluated_at);
  const totalWeight = tasks.reduce((s, t) => s + t.kpi_weight, 0);
  const avgKPI = totalWeight > 0
    ? Math.round(tasks.reduce((s, t) => s + t.expect_score * t.kpi_weight, 0) / totalWeight)
    : 0;
  // Recent tasks: prioritize tasks assigned to or created by the current user, sorted by updated_at
  const recentTasks = [...tasks]
    .filter((t) => t.assignee_id === user?.id || t.assigner_id === user?.id)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8);
  const activeProjects = projects.filter((p) => p.status === "active");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold">
          {t.dashboard.greeting}, {user?.full_name?.split(" ").pop() || "bạn"} {t.dashboard.greetingSuffix}
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
        />
        <StatCard
          label={t.dashboard.inProgress}
          value={tasks.filter((t) => t.status === "in_progress").length}
          subtitle={`${review.length} ${t.dashboard.pendingReview}`}
          accentColor="#3b82f6"
          onClick={() => setStatPanel("in_progress")}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Tasks */}
        <div className="lg:col-span-2">
          <Section
            title={t.dashboard.recentTasks}
            action={
              <button onClick={() => router.push("/tasks")} className="text-sm text-primary hover:underline">
                {t.common.viewAll} →
              </button>
            }
          >
            {tasksLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="p-6">
                <EmptyState icon="📋" title={t.dashboard.noTasks} subtitle={t.dashboard.noTasksSub} />
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
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Active Projects */}
          <Section
            title={t.dashboard.activeProjects}
            action={
              <button onClick={() => router.push("/projects")} className="text-sm text-primary hover:underline">
                {t.common.viewAll} →
              </button>
            }
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

          {/* Quick KPI */}
          <Section title={t.dashboard.kpiQuick}>
            <div className="p-4 flex items-center justify-center gap-6">
              <div className="text-center">
                <KPIRing score={avgKPI} size={64} strokeWidth={5} />
                <p className="text-[11px] text-muted-foreground mt-1">{t.dashboard.kpiAvg}</p>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">{t.dashboard.evaluatedLabel}</span>
                  <span className="font-mono font-semibold">{evaluated.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">{t.dashboard.pendingLabel}</span>
                  <span className="font-mono font-semibold">{review.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">{t.dashboard.overdueLabel}</span>
                  <span className="font-mono font-semibold">{overdue.length}</span>
                </div>
              </div>
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
