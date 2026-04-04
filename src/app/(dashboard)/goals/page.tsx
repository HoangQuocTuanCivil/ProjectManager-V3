"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGoals, goalKeys } from "@/lib/hooks/use-goals";
import { useAuthStore } from "@/lib/stores";
import { createClient } from "@/lib/supabase/client";
import { Button, FilterChip, EmptyState, ProgressBar, UserAvatar, StatCard } from "@/components/shared";
import { Dialog, DialogContent } from "@/components/shared/dialog";
import { ROLE_CONFIG, formatDate } from "@/lib/utils/kpi";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import type { Goal, GoalType, GoalStatus } from "@/lib/types";

const TYPE_COLORS: Record<GoalType, { icon: string; color: string }> = {
  company: { icon: "🏢", color: "#6366f1" },
  center: { icon: "🏬", color: "#8b5cf6" },
  department: { icon: "🏛️", color: "#3b82f6" },
  team: { icon: "👥", color: "#10b981" },
  personal: { icon: "👤", color: "#f59e0b" },
};

const STATUS_COLORS: Record<GoalStatus, string> = {
  on_track: "#10b981",
  at_risk: "#f59e0b",
  off_track: "#ef4444",
  achieved: "#6366f1",
  cancelled: "#6b7280",
};

type ViewMode = "tree" | "grid";

export default function GoalsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data, isLoading } = useGoals();
  const goals = (data as any)?.tree || (Array.isArray(data) ? data : []);
  const allGoals = (data as any)?.all || goals;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<GoalType | "all">("all");
  const [view, setView] = useState<ViewMode>("tree");

  const TYPE_CONFIG: Record<GoalType, { label: string; icon: string; color: string }> = {
    company: { label: t.goals.company, icon: "🏢", color: "#6366f1" },
    center: { label: t.goals.center, icon: "🏬", color: "#8b5cf6" },
    department: { label: t.goals.department, icon: "🏛️", color: "#3b82f6" },
    team: { label: t.goals.team, icon: "👥", color: "#10b981" },
    personal: { label: t.goals.personal, icon: "👤", color: "#f59e0b" },
  };

  const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string }> = {
    on_track: { label: t.goals.onTrack, color: "#10b981" },
    at_risk: { label: t.goals.atRisk, color: "#f59e0b" },
    off_track: { label: t.goals.offTrack, color: "#ef4444" },
    achieved: { label: t.goals.achieved, color: "#6366f1" },
    cancelled: { label: t.goals.cancelled, color: "#6b7280" },
  };

  const canManage = user && ["admin", "leader", "head", "team_leader"].includes(user.role);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("goals").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.list() });
      queryClient.invalidateQueries({ queryKey: ["goals", "all-for-parent"] });
      toast.success("OK");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = typeFilter === "all" ? goals : goals.filter((g: any) => g.goal_type === typeFilter);

  // Stats count ALL goals (not just top-level)
  const stats = {
    total: allGoals.length,
    onTrack: allGoals.filter((g: any) => g.status === "on_track").length,
    atRisk: allGoals.filter((g: any) => g.status === "at_risk").length,
    achieved: allGoals.filter((g: any) => g.status === "achieved").length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.goals.pageTitle}</h1>
          <p className="text-base text-muted-foreground mt-0.5">
            {t.goals.pageSubtitle}
          </p>
        </div>
        <Button variant="primary" onClick={() => router.push("/goals/new")}>
          {t.goals.createGoal}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t.goals.totalGoals} value={stats.total} accentColor="hsl(var(--primary))" />
        <StatCard label={t.goals.onTrack} value={stats.onTrack} accentColor="#10b981" />
        <StatCard label={t.goals.atRisk} value={stats.atRisk} accentColor="#f59e0b" />
        <StatCard label={t.goals.achieved} value={stats.achieved} accentColor="#6366f1" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
          {t.common.all}
        </FilterChip>
        {(["company", "department", "team", "personal"] as GoalType[]).map((gt) => (
          <FilterChip key={gt} active={typeFilter === gt} onClick={() => setTypeFilter(gt)}>
            {TYPE_CONFIG[gt].icon} {TYPE_CONFIG[gt].label}
          </FilterChip>
        ))}

        <div className="ml-auto flex items-center border border-border rounded-lg overflow-hidden">
          {(["tree", "grid"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {v === "tree" ? `🌳 ${t.goals.treeView}` : `▦ ${t.goals.gridView}`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🚀" title={t.goals.noGoals} subtitle={t.goals.noGoalsSub} />
      ) : view === "tree" ? (
        <GoalTree goals={filtered} onClick={(id) => router.push(`/goals/${id}`)} canManage={!!canManage} onEdit={(id) => router.push(`/goals/${id}`)} onDelete={(id) => setDeleteTarget(id)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((goal: any) => (
            <GoalCard key={goal.id} goal={goal} onClick={() => router.push(`/goals/${goal.id}`)} canManage={!!canManage} onEdit={() => router.push(`/goals/${goal.id}`)} onDelete={() => setDeleteTarget(goal.id)} />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent title={t.goals.deleteGoal} size="sm">
          <p className="text-base text-muted-foreground">
            {t.goals.deleteConfirm}
          </p>
          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-base rounded-lg border border-border hover:bg-secondary transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget, {
                    onSuccess: () => setDeleteTarget(null),
                  });
                }
              }}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 text-base rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMutation.isPending ? t.common.deleting : t.goals.deleteGoal}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function GoalTree({ goals, onClick, canManage, onEdit, onDelete }: { goals: any[]; onClick: (id: string) => void; canManage: boolean; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {goals.map((goal: any) => (
        <GoalTreeNode key={goal.id} goal={goal} depth={0} onClick={onClick} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function GoalTreeNode({ goal, depth, onClick, canManage, onEdit, onDelete }: { goal: any; depth: number; onClick: (id: string) => void; canManage: boolean; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  const typeLabels: Record<string, string> = {
    company: t.goals.company,
    department: t.goals.department,
    team: t.goals.team,
    personal: t.goals.personal,
  };
  const statusLabels: Record<string, string> = {
    on_track: t.goals.onTrack,
    at_risk: t.goals.atRisk,
    off_track: t.goals.offTrack,
    achieved: t.goals.achieved,
    cancelled: t.goals.cancelled,
  };

  const typeCfg = TYPE_COLORS[goal.goal_type as GoalType] || TYPE_COLORS.personal;
  const typeLabel = typeLabels[goal.goal_type] || goal.goal_type;
  const statusColor = STATUS_COLORS[goal.status as GoalStatus] || STATUS_COLORS.on_track;
  const statusLabel = statusLabels[goal.status] || goal.status;
  const hasChildren = goal.sub_goals && goal.sub_goals.length > 0;
  const hasTargets = goal.targets && goal.targets.length > 0;

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div
        className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all cursor-pointer"
        onClick={() => onClick(goal.id)}
      >
        {/* Color bar */}
        <div className="h-[3px]" style={{ background: typeCfg.color }} />

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Expand toggle */}
            {hasChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="mt-0.5 w-5 h-5 rounded flex items-center justify-center text-[11px] hover:bg-secondary transition-colors flex-shrink-0"
              >
                {expanded ? "▼" : "▶"}
              </button>
            )}
            {!hasChildren && <div className="w-5 flex-shrink-0" />}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{typeCfg.icon}</span>
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                  style={{ background: `${typeCfg.color}15`, color: typeCfg.color }}
                >
                  {typeLabel}
                </span>
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                  style={{ background: `${statusColor}15`, color: statusColor }}
                >
                  {statusLabel}
                </span>
                {goal.period_label && (
                  <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {goal.period_label}
                  </span>
                )}
              </div>

              <h3 className="text-[14px] font-bold leading-snug">{goal.title}</h3>
              {goal.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{goal.description}</p>
              )}

              {/* Progress */}
              <div className="flex items-center gap-3 mt-2.5">
                <ProgressBar value={goal.progress} />
                {goal.owner && (
                  <UserAvatar
                    name={goal.owner.full_name}
                    color={ROLE_CONFIG[goal.owner.role as keyof typeof ROLE_CONFIG]?.color}
                    size="xs"
                  />
                )}
              </div>

              {/* Key Results */}
              {hasTargets && (
                <div className="mt-2 space-y-1">
                  {goal.targets.slice(0, 3).map((tgt: any) => {
                    const pct = tgt.target_value > 0 ? Math.round(((tgt.current_value - tgt.start_value) / (tgt.target_value - tgt.start_value)) * 100) : 0;
                    return (
                      <div key={tgt.id} className="flex items-center gap-2 text-xs">
                        <span className={tgt.is_completed ? "text-green-500" : "text-muted-foreground"}>
                          {tgt.is_completed ? "✓" : "○"}
                        </span>
                        <span className="flex-1 truncate text-muted-foreground">{tgt.title}</span>
                        <span className="font-mono text-[11px]">
                          {tgt.current_value}/{tgt.target_value} {tgt.unit || ""}
                        </span>
                        <div className="w-12 h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "#10b981" : "hsl(var(--primary))" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date + Actions */}
            <div className="text-right flex-shrink-0 space-y-1">
              <p className="font-mono text-[11px] text-muted-foreground">{formatDate(goal.due_date)}</p>
              {hasChildren && (
                <p className="text-[11px] text-muted-foreground">{goal.sub_goals.length} {t.goals.children}</p>
              )}
              {canManage && (
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={(e) => { e.stopPropagation(); onEdit(goal.id); }} className="text-xs text-primary hover:underline">{t.common.edit}</button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(goal.id); }} className="text-xs text-destructive hover:underline">{t.common.delete}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-2 space-y-2">
          {goal.sub_goals.map((child: any) => (
            <GoalTreeNode key={child.id} goal={child} depth={depth + 1} onClick={onClick} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}


function GoalCard({ goal, onClick, canManage, onEdit, onDelete }: { goal: any; onClick: () => void; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const { t } = useI18n();

  const typeLabels: Record<string, string> = {
    company: t.goals.company,
    department: t.goals.department,
    team: t.goals.team,
    personal: t.goals.personal,
  };
  const statusLabels: Record<string, string> = {
    on_track: t.goals.onTrack,
    at_risk: t.goals.atRisk,
    off_track: t.goals.offTrack,
    achieved: t.goals.achieved,
    cancelled: t.goals.cancelled,
  };

  const typeCfg = TYPE_COLORS[goal.goal_type as GoalType] || TYPE_COLORS.personal;
  const typeLabel = typeLabels[goal.goal_type] || goal.goal_type;
  const statusColor = STATUS_COLORS[goal.status as GoalStatus] || STATUS_COLORS.on_track;
  const statusLabel = statusLabels[goal.status] || goal.status;
  const targetsDone = goal.targets?.filter((tgt: any) => tgt.is_completed).length || 0;
  const targetsTotal = goal.targets?.length || 0;

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="h-[3px]" style={{ background: typeCfg.color }} />
      <div className="p-4 space-y-3">
        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${typeCfg.color}15`, color: typeCfg.color }}>
            {typeCfg.icon} {typeLabel}
          </span>
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${statusColor}15`, color: statusColor }}>
            {statusLabel}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold leading-snug line-clamp-2">{goal.title}</h3>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">{t.goals.progressLabel}</span>
            <span className="font-mono text-sm font-semibold">{goal.progress}%</span>
          </div>
          <ProgressBar value={goal.progress} showText={false} />
        </div>

        {/* Targets summary */}
        {targetsTotal > 0 && (
          <p className="text-xs text-muted-foreground">
            {targetsDone}/{targetsTotal} {t.goals.keyResults}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            {goal.owner && (
              <UserAvatar name={goal.owner.full_name} color={ROLE_CONFIG[goal.owner.role as keyof typeof ROLE_CONFIG]?.color} size="xs" />
            )}
            {goal.period_label && (
              <span className="text-[11px] text-muted-foreground">{goal.period_label}</span>
            )}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">{formatDate(goal.due_date)}</span>
        </div>
        {canManage && (
          <div className="flex gap-2 pt-2 border-t border-border/50">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-xs text-primary hover:underline">{t.common.edit}</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-xs text-destructive hover:underline">{t.common.delete}</button>
          </div>
        )}
      </div>
    </div>
  );
}
