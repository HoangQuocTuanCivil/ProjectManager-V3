"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "./dialog";
import { StatusBadge, ProgressBar, UserAvatar, PriorityBadge, EmptyState } from "./index";
import { TaskDetail } from "@/components/tasks/task-detail";
import { ClipboardList } from "lucide-react";
import { ROLE_CONFIG, formatRelativeDate } from "@/lib/utils/kpi";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import type { Task } from "@/lib/types";

export type StatPanelType = "total" | "in_progress" | "overdue" | "processing" | "review" | "evaluated" | null;

interface TaskListPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelType: StatPanelType;
  tasks: Task[];
}

export function TaskListPanel({ open, onOpenChange, panelType, tasks }: TaskListPanelProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const titleMap: Record<string, string> = {
    total: t.dashboard.totalTasks,
    in_progress: t.dashboard.inProgress,
    overdue: t.dashboard.overdueCard,
    processing: t.dashboard.processing,
    review: t.dashboard.pendingReview,
    evaluated: t.dashboard.evaluatedLabel,
  };

  const filteredTasks = tasks
    .filter((task) => {
      if (panelType === "total") return !["cancelled"].includes(task.status);
      if (panelType === "in_progress") return task.status === "in_progress";
      if (panelType === "overdue") return task.status === "overdue";
      if (panelType === "processing") return !["completed", "cancelled"].includes(task.status);
      if (panelType === "review") return task.status === "review";
      if (panelType === "evaluated") return !!task.kpi_evaluated_at;
      return false;
    })
    .sort((a, b) => {
      // Sort by deadline ascending (nearest first), no-deadline items last
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`${titleMap[panelType ?? "total"]} (${filteredTasks.length})`}
        description={t.dashboard.panelDesc}
        size="xl"
        className="max-h-[80vh] flex flex-col"
        preventAutoClose={!!selectedTaskId}
      >
        <div className="overflow-y-auto -mx-5 -mb-5 px-5 pb-5 max-h-[60vh]">
          {filteredTasks.length === 0 ? (
            <EmptyState icon={<ClipboardList size={32} strokeWidth={1.5} />} title={t.dashboard.noTasks} subtitle={t.dashboard.noTasksSub} />
          ) : (
            <div className="divide-y divide-border/40">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task.id)}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-secondary/40 cursor-pointer transition-colors rounded-lg -mx-1"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {task.project && (
                        <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
                          {task.project.code}
                        </span>
                      )}
                      <span className="text-sm font-medium truncate">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {task.deadline && (
                        <span>{formatRelativeDate(task.deadline)}</span>
                      )}
                      <PriorityBadge priority={task.priority} />
                    </div>
                  </div>
                  <StatusBadge status={task.status} />
                  <ProgressBar value={task.progress} className="hidden sm:flex" />
                  {task.assignee && (
                    <UserAvatar
                      name={task.assignee.full_name}
                      color={ROLE_CONFIG[task.assignee.role]?.color}
                      size="xs"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {filteredTasks.length > 0 && (
          <div className="pt-3 border-t border-border -mx-5 px-5 -mb-5 pb-4">
            <button
              onClick={() => { onOpenChange(false); router.push("/tasks"); }}
              className="text-sm text-primary hover:underline font-medium"
            >
              {t.common.viewAll} →
            </button>
          </div>
        )}
      </DialogContent>

      {/* Panel chi tiết task: hiển thị đè lên dialog danh sách, z-index cao hơn */}
      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          zIndex={60}
        />
      )}
    </Dialog>
  );
}
