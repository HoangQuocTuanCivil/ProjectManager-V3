"use client";

import { Section, HealthBadge, ProgressBar, UserAvatar, StatusBadge, Button, KPIRing, VerdictBadge } from "@/components/shared";
import { ROLE_CONFIG, formatDate, formatVND, getVerdict } from "@/lib/utils/kpi";
import type { Project, ProjectMember, Milestone, Task } from "@/lib/types";

export function ProjectHealthCard({ project, tasks }: { project: Project; tasks: Task[] }) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.status === "overdue").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const progress = total > 0 ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total) : 0;
  const health = overdue / Math.max(total, 1) > 0.2 ? "red" : overdue > 0 ? "yellow" : total === 0 ? "gray" : "green";

  const evaluated = tasks.filter((t) => t.kpi_evaluated_at);
  const avgKPI = evaluated.length > 0 ? Math.round(evaluated.reduce((s, t) => s + (t.actual_score || 0), 0) / evaluated.length) : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="h-[3px]" style={{ background: health === "green" ? "#10b981" : health === "yellow" ? "#f59e0b" : health === "red" ? "#ef4444" : "#64748b" }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base text-primary font-bold">{project.code}</span>
              <HealthBadge health={health as any} />
            </div>
            <h2 className="text-base font-bold mt-1">{project.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {project.client} · {project.location} · {formatDate(project.start_date)} → {formatDate(project.end_date)}
            </p>
          </div>
          <KPIRing score={avgKPI || progress} size={56} strokeWidth={4} />
        </div>

        <ProgressBar value={progress} className="mb-3" />

        <div className="grid grid-cols-5 gap-2 text-center">
          <div><p className="font-mono text-base font-bold">{total}</p><p className="text-[10px] text-muted-foreground">Tổng tasks</p></div>
          <div><p className="font-mono text-base font-bold text-blue-400">{inProgress}</p><p className="text-[10px] text-muted-foreground">Đang làm</p></div>
          <div><p className="font-mono text-base font-bold text-green-400">{completed}</p><p className="text-[10px] text-muted-foreground">Hoàn thành</p></div>
          <div><p className="font-mono text-base font-bold" style={{ color: overdue > 0 ? "#ef4444" : "#94a3b8" }}>{overdue}</p><p className="text-[10px] text-muted-foreground">Quá hạn</p></div>
          <div><p className="font-mono text-base font-bold text-amber-400">{formatVND(project.allocation_fund)}</p><p className="text-[10px] text-muted-foreground">Quỹ khoán</p></div>
        </div>
      </div>
    </div>
  );
}

export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  const sorted = [...milestones].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const now = new Date();

  return (
    <Section title={`◆ Milestones (${milestones.length})`}>
      <div className="p-4 space-y-2">
        {sorted.map((m) => {
          const isPast = new Date(m.due_date) < now;
          const statusColor = m.status === "reached" ? "#10b981" : m.status === "missed" ? "#ef4444" : isPast ? "#f59e0b" : "#38bdf8";
          return (
            <div key={m.id} className="flex items-center gap-3 py-1.5">
              <span className="text-base" style={{ color: statusColor }}>◆</span>
              <span className="text-sm font-semibold flex-1">{m.title}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{formatDate(m.due_date)}</span>
              <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: `${statusColor}18`, color: statusColor }}>
                {m.status === "reached" ? "Đã đạt" : m.status === "missed" ? "Bị lỡ" : isPast ? "Trễ" : "Sắp tới"}
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function ProjectMemberList({ members }: { members: ProjectMember[] }) {
  const roleOrder = { manager: 0, leader: 1, engineer: 2, reviewer: 3 };
  const sorted = [...members].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));
  const roleLabels: Record<string, string> = { manager: "CNĐA", leader: "Nhóm trưởng", engineer: "Kỹ sư", reviewer: "Kiểm tra" };

  return (
    <Section title={`👥 Thành viên (${members.length})`}>
      <div className="divide-y divide-border/30">
        {sorted.map((m) => (
          <div key={m.id} className="px-4 py-2 flex items-center gap-3">
            {m.user && (
              <>
                <UserAvatar name={m.user.full_name} color={ROLE_CONFIG[m.user.role]?.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{m.user.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{ROLE_CONFIG[m.user.role]?.label}</p>
                </div>
              </>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">{roleLabels[m.role] ?? m.role}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
