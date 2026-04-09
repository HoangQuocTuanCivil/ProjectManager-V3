"use client";

import { useParams } from "next/navigation";
import { useProject } from "@/features/projects";
import { useTasks } from "@/features/tasks";
import { StatCard, Section, StatusBadge, ProgressBar, UserAvatar, KPIRing } from "@/components/shared";
import { ProjectHealthCard, MilestoneTimeline, ProjectMemberList } from "@/features/projects";
import { ROLE_CONFIG, STATUS_CONFIG, formatDate, formatVND, getVerdict, VERDICT_CONFIG } from "@/lib/utils/kpi";
import type { Task } from "@/lib/types";

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: project } = useProject(projectId);
  const { data: allTasks = [] } = useTasks({ project_id: projectId });

  if (!project) return null;

  const tasks = allTasks;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.status === "overdue").length;
  const inReview = tasks.filter((t) => t.status === "review").length;
  const evaluated = tasks.filter((t) => t.kpi_evaluated_at);

  const totalWeight = tasks.reduce((s, t) => s + t.kpi_weight, 0);
  const avgE = totalWeight > 0 ? Math.round(tasks.reduce((s, t) => s + t.expect_score * t.kpi_weight, 0) / totalWeight) : 0;
  const avgA = evaluated.length > 0
    ? Math.round(evaluated.reduce((s, t) => s + t.actual_score * t.kpi_weight, 0) / evaluated.reduce((s, t) => s + t.kpi_weight, 0))
    : 0;

  const members = (project as any).members || [];
  const milestones = (project as any).milestones || [];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Tổng tasks" value={tasks.length} accentColor="hsl(var(--primary))" />
        <StatCard label="Hoàn thành" value={completed} subtitle={`${tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}%`} accentColor="#10b981" />
        <StatCard label="Quá hạn" value={overdue} accentColor="#ef4444" />
        <StatCard label="KPI E (TB)" value={avgE} accentColor="hsl(var(--primary))" />
        <StatCard label="KPI A (TB)" value={evaluated.length > 0 ? avgA : "—"} accentColor={avgA >= avgE ? "#10b981" : "#ef4444"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Tasks overview */}
        <div className="lg:col-span-2 space-y-5">
          {/* Task distribution */}
          <Section title="Phân bố công việc">
            <div className="p-4">
              {tasks.length === 0 ? (
                <p className="text-base text-muted-foreground text-center py-4">Chưa có task nào</p>
              ) : (
                <div className="space-y-2">
                  {(["pending", "in_progress", "review", "completed", "overdue"] as const).map((status) => {
                    const count = tasks.filter((t) => t.status === status).length;
                    const pct = Math.round((count / tasks.length) * 100);
                    const cfg = STATUS_CONFIG[status];
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className="w-20 text-sm text-muted-foreground">{cfg.label}</span>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color }} />
                        </div>
                        <span className="font-mono text-sm w-8 text-right" style={{ color: cfg.color }}>{count}</span>
                        <span className="font-mono text-[11px] text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>

          {/* Recent tasks */}
          <Section title="Tasks gần đây">
            <div className="divide-y divide-border/40">
              {tasks.slice(0, 10).map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                  <StatusBadge status={task.status} />
                  <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
                  <ProgressBar value={task.progress} className="w-20" />
                  <KPIRing score={task.expect_score} size={24} strokeWidth={2} />
                  {task.assignee && (
                    <UserAvatar name={task.assignee.full_name} color={ROLE_CONFIG[task.assignee.role]?.color} size="xs" />
                  )}
                  <span className="font-mono text-[11px] text-muted-foreground w-16 text-right">
                    {formatDate(task.deadline)}
                  </span>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-base text-muted-foreground text-center py-6">Chưa có task</p>
              )}
            </div>
          </Section>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Members */}
          {members.length > 0 && <ProjectMemberList members={members} />}

          {/* Milestones */}
          {milestones.length > 0 && <MilestoneTimeline milestones={milestones} />}

          {/* KPI Summary */}
          <Section title="KPI Tổng hợp">
            <div className="p-4 flex items-center justify-center gap-6">
              <div className="text-center">
                <KPIRing score={avgE} size={56} strokeWidth={4} />
                <p className="text-[11px] text-muted-foreground mt-1">E (kỳ vọng)</p>
              </div>
              {evaluated.length > 0 && (
                <>
                  <span className="text-muted-foreground text-lg">→</span>
                  <div className="text-center">
                    <KPIRing score={avgA} size={56} strokeWidth={4} />
                    <p className="text-[11px] text-muted-foreground mt-1">A (thực tế)</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-2xl font-bold" style={{ color: avgA >= avgE ? "#10b981" : "#ef4444" }}>
                      {avgA - avgE >= 0 ? "+" : ""}{avgA - avgE}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Chênh lệch</p>
                  </div>
                </>
              )}
            </div>
            <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
              {evaluated.length}/{tasks.length} tasks đã nghiệm thu
            </div>
          </Section>

          {/* Fund */}
          <Section title="Tài chính">
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ngân sách</span>
                <span className="font-mono font-semibold">{formatVND(project.budget)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quỹ khoán</span>
                <span className="font-mono font-bold text-amber-500">{formatVND(project.allocation_fund)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Tỷ lệ khoán/NS</span>
                <span className="font-mono font-semibold">
                  {project.budget > 0 ? Math.round((project.allocation_fund / project.budget) * 100) : 0}%
                </span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
