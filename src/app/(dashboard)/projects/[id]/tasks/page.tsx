"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTasks } from "@/lib/hooks/use-tasks";
import { StatusBadge, PriorityBadge, ProgressBar, UserAvatar, KPIRing, FilterChip, Button, EmptyState } from "@/components/shared";
import { ClipboardList } from "lucide-react";
import { ROLE_CONFIG, STATUS_CONFIG, formatDate } from "@/lib/utils/kpi";
import { TaskDetail } from "@/components/tasks/task-detail";
import { TaskForm } from "@/components/tasks/task-form";
import type { TaskStatus } from "@/lib/types";

export default function ProjectTasksPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: tasks = [], isLoading } = useTasks({ project_id: projectId });
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filtered = statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
            Tất cả ({tasks.length})
          </FilterChip>
          {(["pending", "in_progress", "review", "completed", "overdue"] as TaskStatus[]).map((s) => {
            const count = tasks.filter((t) => t.status === s).length;
            if (count === 0) return null;
            return (
              <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label} ({count})
              </FilterChip>
            );
          })}
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>+ Giao việc</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-card border border-border rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList size={32} strokeWidth={1.5} />} title="Chưa có công việc" subtitle="Giao việc mới cho dự án này" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Công việc", "Trạng thái", "Ưu tiên", "Người làm", "KPI", "Tiến độ", "Deadline"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr key={task.id} onClick={() => setSelectedTaskId(task.id)} className="border-b border-border/40 hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 text-sm font-medium truncate max-w-[460px]">{task.title}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-2.5"><PriorityBadge priority={task.priority} /></td>
                  <td className="px-4 py-2.5">
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <UserAvatar name={task.assignee.full_name} color={ROLE_CONFIG[task.assignee.role]?.color} size="xs" />
                        <span className="text-sm truncate max-w-[80px]">{task.assignee.full_name}</span>
                      </div>
                    ) : <span className="text-sm text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <KPIRing score={task.expect_score} size={24} strokeWidth={2} />
                      <span className="font-mono text-sm">{Math.round(task.expect_score)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><ProgressBar value={task.progress} /></td>
                  <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">{formatDate(task.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTaskId && <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
      {showForm && <TaskForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
