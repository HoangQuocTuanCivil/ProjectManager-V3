"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkflows, useToggleWorkflow, useDeleteWorkflow } from "@/lib/hooks/use-workflows";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores";
import { Button, Toggle, FilterChip, EmptyState, Section, StatCard, UserAvatar } from "@/components/shared";
import { Dialog, DialogContent } from "@/components/shared/dialog";
import { ROLE_CONFIG, formatDate } from "@/lib/utils/kpi";
import { useI18n } from "@/lib/i18n";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import type { WorkflowStepType } from "@/lib/types";

const STEP_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  create: { icon: "✏️", color: "#38bdf8" },
  assign: { icon: "👤", color: "#06b6d4" },
  execute: { icon: "⚡", color: "#10b981" },
  submit: { icon: "📤", color: "#8b5cf6" },
  review: { icon: "🔍", color: "#f59e0b" },
  approve: { icon: "✅", color: "#10b981" },
  reject: { icon: "❌", color: "#ef4444" },
  revise: { icon: "🔄", color: "#f97316" },
  calculate: { icon: "🔢", color: "#6366f1" },
  notify: { icon: "🔔", color: "#ec4899" },
  archive: { icon: "📦", color: "#64748b" },
  custom: { icon: "⚙️", color: "#94a3b8" },
};


export default function WorkflowsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { data: workflows = [], isLoading } = useWorkflows();
  const toggleWorkflow = useToggleWorkflow();
  const deleteWf = useDeleteWorkflow();
  const [showBuilder, setShowBuilder] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const filtered = filter === "all" ? workflows
    : filter === "active" ? workflows.filter((w: any) => w.is_active)
    : workflows.filter((w: any) => !w.is_active);

  const activeCount = workflows.filter((w: any) => w.is_active).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.workflows.pageTitle}</h1>
          <p className="text-base text-muted-foreground mt-0.5">
            {t.workflows.stats.replace("{total}", String(workflows.length)).replace("{pending}", String(0))}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowBuilder(true)}>
          {t.workflows.createWorkflow}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t.workflows.totalWorkflows} value={workflows.length} accentColor="hsl(var(--primary))" />
        <StatCard label={t.workflows.activeWf} value={activeCount} accentColor="#10b981" />
        <StatCard label={t.workflows.pendingApproval} value={0} accentColor="#f59e0b" />
        <StatCard label={t.workflows.disabledWf} value={workflows.length - activeCount} accentColor="#94a3b8" />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>{t.workflows.filterAll}</FilterChip>
        <FilterChip active={filter === "active"} onClick={() => setFilter("active")}>{t.workflows.filterEnabled}</FilterChip>
        <FilterChip active={filter === "inactive"} onClick={() => setFilter("inactive")}>{t.workflows.filterDisabled}</FilterChip>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="⚡" title={t.workflows.noWorkflows} subtitle={t.workflows.noWorkflowsSub} />
      ) : (
        <div className="space-y-3">
          {filtered.map((wf: any) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onToggle={(active) => toggleWorkflow.mutate({ id: wf.id, is_active: active })}
              onClick={() => router.push(`/workflows/${wf.id}`)}
              onDelete={() => setDeleteTarget(wf)}
            />
          ))}
        </div>
      )}

      {/* Builder Modal */}
      {showBuilder && <WorkflowBuilder onClose={() => setShowBuilder(false)} />}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent title={t.workflows.deleteWorkflow} size="sm">
          <p className="text-base text-muted-foreground">
            {t.workflows.deleteConfirm} <strong className="text-foreground">{deleteTarget?.name}</strong>?
          </p>
          <p className="text-sm text-destructive mt-2">{t.common.cannotUndo}</p>
          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-base rounded-lg border border-border hover:bg-secondary transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={async () => {
                if (deleteTarget) {
                  try {
                    await deleteWf.mutateAsync(deleteTarget.id);
                    toast.success("OK");
                    setDeleteTarget(null);
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }
              }}
              disabled={deleteWf.isPending}
              className="px-4 py-2 text-base rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteWf.isPending ? t.common.deleting : t.workflows.deleteWorkflow}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkflowCard({
  workflow,
  onToggle,
  onClick,
  onDelete,
}: {
  workflow: any;
  onToggle: (active: boolean) => void;
  onClick: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const steps = workflow.steps || [];
  const sortedSteps = [...steps].sort((a: any, b: any) => a.step_order - b.step_order);
  const scopeLabels: Record<string, string> = {
    global: t.workflows.scopeGlobal,
    department: t.workflows.scopeDept,
    project: t.workflows.scopeProject,
    task_type: t.workflows.scopeTaskType,
  };

  return (
    <div
      className={`bg-card border rounded-xl overflow-hidden transition-all cursor-pointer hover:border-primary/40 ${
        workflow.is_active ? "border-border" : "border-border/50 opacity-60"
      }`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold">{workflow.name}</h3>
              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                workflow.is_active ? "bg-green-500/10 text-green-500" : "bg-secondary text-muted-foreground"
              }`}>
                {workflow.is_active ? t.workflows.filterEnabled : t.workflows.filterDisabled}
              </span>
              <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                {scopeLabels[workflow.scope] || workflow.scope}
              </span>
              {workflow.is_default && (
                <span className="text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">{t.common.default}</span>
              )}
            </div>
            {workflow.description && (
              <p className="text-sm text-muted-foreground">{workflow.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={onDelete} className="text-[11px] text-destructive hover:underline">{t.common.delete}</button>
            <Toggle checked={workflow.is_active} onChange={onToggle} />
          </div>
        </div>

        {/* Steps flow */}
        <div className="flex items-center gap-1 flex-wrap">
          {sortedSteps.map((step: any, idx: number) => {
            const cfg = STEP_TYPE_CONFIG[step.step_type] || { icon: "⚙️", color: "#94a3b8" };
            return (
              <div key={step.id || idx} className="flex items-center gap-1">
                {idx > 0 && <span className="text-muted-foreground text-[11px]">→</span>}
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary border border-border/50 text-[11px]">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    style={{ background: cfg.color }}>
                    {idx + 1}
                  </span>
                  <span className="font-medium truncate max-w-[80px]">{step.name}</span>
                  {step.is_automatic && <span className="text-purple-400 text-[8px]">⚙</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          <span>{sortedSteps.length} {t.workflows.steps}</span>
          <span>{sortedSteps.filter((s: any) => s.is_automatic).length} {t.workflows.automatic}</span>
          {sortedSteps.some((s: any) => s.sla_hours) && (
            <span>SLA: {sortedSteps.filter((s: any) => s.sla_hours).map((s: any) => `${s.sla_hours}h`).join(", ")}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingApprovalCard({
  item,
  onAdvance,
  isPending,
}: {
  item: any;
  onAdvance: (result: string, note?: string) => void;
  isPending: boolean;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  const [showActions, setShowActions] = useState(false);
  const stepCfg = STEP_TYPE_CONFIG[item.current_step?.step_type] || { icon: "⚙️", color: "#94a3b8" };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start gap-3">
        {/* Step indicator */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: `${stepCfg.color}15` }}
        >
          {stepCfg.icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* Task info */}
          <div className="flex items-center gap-2 mb-1">
            {item.task?.project && (
              <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {item.task.project.code}
              </span>
            )}
            <h4 className="text-base font-bold truncate">{item.task?.title || "Task"}</h4>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span>{t.workflows.stepLabel} <span className="font-medium text-foreground">{item.current_step?.name}</span></span>
            <span>·</span>
            <span>{t.workflows.typeLabel} <span style={{ color: stepCfg.color }}>{item.current_step?.step_type}</span></span>
            {item.task?.assignee && (
              <>
                <span>·</span>
                <span>{t.workflows.assigneeLabel} {item.task.assignee.full_name}</span>
              </>
            )}
            <span>·</span>
            <span>{formatDate(item.entered_at)}</span>
          </div>

          {/* Actions */}
          {showActions ? (
            <div className="space-y-2 animate-slide-in-bottom">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={t.workflows.notePlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none resize-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onAdvance("approved", note || undefined)}
                  disabled={isPending}
                >
                  {isPending ? "..." : `✓ ${t.workflows.approveBtn}`}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onAdvance("rejected", note || undefined)}
                  disabled={isPending}
                >
                  ✕ {t.workflows.rejectBtn}
                </Button>
                <Button
                  size="sm"
                  onClick={() => onAdvance("revise", note || undefined)}
                  disabled={isPending}
                >
                  ↩ {t.workflows.reviseBtn}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowActions(false)}>{t.common.cancel}</Button>
              </div>
            </div>
          ) : (
            <Button size="xs" variant="primary" onClick={() => setShowActions(true)}>
              {t.workflows.processBtn}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
