"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { useAllocationPeriods, useAllocationConfig, kpiKeys, useCalculateAllocation, useApproveAllocation, useCreateAllocationPeriod, useDeleteAllocationPeriod } from "@/lib/hooks/use-kpi";
import { useUsers } from "@/lib/hooks/use-users";
import { useAuthStore } from "@/lib/stores";
import { createClient } from "@/lib/supabase/client";
import {
  StatCard, Section, Button, EmptyState, UserAvatar, KPIRing, KPIScoreBar, VerdictBadge, ProgressBar,
} from "@/components/shared";
import { SearchSelect } from "@/shared/ui/search-select";
import { AllocationTable, UserKPICard } from "@/components/kpi";
import { ROLE_CONFIG, VERDICT_CONFIG, formatVND, formatDate, formatPercent, getVerdict, calcKPIScore } from "@/lib/utils/kpi";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import type { Task, AllocationPeriod, AllocationMode } from "@/lib/types";

type KPITab = "overview" | "allocation" | "config";

export default function KPIPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<KPITab>("overview");
  const { data: tasks = [] } = useTasks({});
  const { data: users = [] } = useUsers();
  const { data: periods = [] } = useAllocationPeriods();
  const { data: config } = useAllocationConfig();
  const { user } = useAuthStore();

  const tabs: { key: KPITab; label: string; icon: string }[] = [
    { key: "overview", label: t.kpi.overviewTab, icon: "🎯" },
    { key: "allocation", label: t.kpi.allocationTab, icon: "💰" },
    { key: "config", label: t.kpi.configTab, icon: "⚙️" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.kpi.pageTitle}</h1>
          <p className="text-base text-muted-foreground mt-0.5">
            {t.kpi.pageSubtitle}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === tb.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && <KPIOverview tasks={tasks} users={users} />}
      {tab === "allocation" && <AllocationSection periods={periods} user={user} />}
      {tab === "config" && <KPIConfig config={config} user={user} />}
    </div>
  );
}

function KPIOverview({ tasks, users }: { tasks: Task[]; users: any[] }) {
  const { t } = useI18n();
  const [projectFilter, setProjectFilter] = useState("all");
  const { data: projects = [] } = useProjects();

  // Filter tasks by project
  const filteredTasks = projectFilter === "all" ? tasks : tasks.filter((tk) => tk.project_id === projectFilter);

  const evaluated = filteredTasks.filter((tk) => tk.kpi_evaluated_at);
  const totalWeight = filteredTasks.reduce((s, tk) => s + tk.kpi_weight, 0);
  const avgE = totalWeight > 0
    ? Math.round(filteredTasks.reduce((s, tk) => s + tk.expect_score * tk.kpi_weight, 0) / totalWeight)
    : 0;
  const avgA = evaluated.length > 0
    ? Math.round(evaluated.reduce((s, tk) => s + tk.actual_score * tk.kpi_weight, 0) / evaluated.reduce((s, tk) => s + tk.kpi_weight, 0))
    : 0;

  // Group tasks by user
  const userTaskMap = new Map<string, Task[]>();
  filteredTasks.forEach((tk) => {
    if (tk.assignee_id) {
      const arr = userTaskMap.get(tk.assignee_id) || [];
      arr.push(tk);
      userTaskMap.set(tk.assignee_id, arr);
    }
  });

  return (
    <div className="space-y-5">
      {/* Project Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground font-medium">{t.common.filterByProject}</span>
        <SearchSelect
          value={projectFilter}
          onChange={(val) => setProjectFilter(val)}
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

function AllocationSection({ periods, user }: { periods: AllocationPeriod[]; user: any }) {
  const { t } = useI18n();
  const createPeriod = useCreateAllocationPeriod();
  const calculateAlloc = useCalculateAllocation();
  const approveAlloc = useApproveAllocation();
  const deletePeriod = useDeleteAllocationPeriod();
  const { data: projects = [] } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [newPeriod, setNewPeriod] = useState({
    name: "",
    total_fund: 0,
    project_id: "",
    payment_percent: 100,
    period_start: "",
    period_end: "",
    mode: "per_project" as AllocationMode,
  });

  const handleCreate = async () => {
    if (!newPeriod.name || !newPeriod.total_fund) { toast.error("Vui lòng nhập tên và quỹ khoán"); return; }
    if (newPeriod.mode === "per_project" && !newPeriod.project_id) { toast.error("Vui lòng chọn dự án"); return; }
    try {
      const { payment_percent, ...submitData } = newPeriod;
      if (!submitData.project_id) delete (submitData as any).project_id;
      await createPeriod.mutateAsync(submitData);
      toast.success("Tạo đợt khoán thành công!");
      setShowForm(false);
      setNewPeriod({ name: "", total_fund: 0, project_id: "", payment_percent: 100, period_start: "", period_end: "", mode: "per_project" });
    } catch (e: any) {
      toast.error(e.message || "Lỗi tạo đợt khoán");
    }
  };

  const canApprove = user && ["admin", "leader"].includes(user.role);

  // Visibility: non-leadership users can only see approved periods
  const visiblePeriods = canApprove
    ? periods
    : periods.filter((p) => p.status === "approved");

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-base text-muted-foreground">{visiblePeriods.length} {t.kpi.allocationPeriods}</p>
        {canApprove && (
          <Button variant="primary" onClick={() => setShowForm(true)}>{t.kpi.createPeriod}</Button>
        )}
      </div>

      {/* New Period Form */}
      {showForm && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4 animate-slide-in-bottom">
          <h3 className="text-base font-bold text-primary">{t.kpi.createPeriodTitle}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.periodName}</label>
              <input
                value={newPeriod.name}
                onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })}
                placeholder={t.kpi.periodNamePlaceholder}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.mode}</label>
              <SearchSelect
                value={newPeriod.mode}
                onChange={(val) => setNewPeriod({ ...newPeriod, mode: val as any, project_id: "", total_fund: 0, payment_percent: 100 })}
                options={[
                  { value: "per_project", label: t.kpi.modeProject },
                  { value: "global", label: t.kpi.modeSummary },
                ]}
                placeholder={t.kpi.selectMode}
                className="mt-1"
              />
            </div>
            {newPeriod.mode === "per_project" && (
              <div>
                <label className="text-sm text-muted-foreground font-medium">{t.kpi.project}</label>
                <SearchSelect
                  value={newPeriod.project_id}
                  onChange={(val) => {
                    const pid = val;
                    const proj = projects.find((p: any) => p.id === pid);
                    const fund = proj ? Math.round((proj.allocation_fund || 0) * newPeriod.payment_percent / 100) : 0;
                    setNewPeriod({ ...newPeriod, project_id: pid, total_fund: fund });
                  }}
                  options={projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name} (${formatVND(p.allocation_fund || 0)})` }))}
                  placeholder={t.kpi.selectProjectDash}
                  className="mt-1"
                />
              </div>
            )}
            {newPeriod.mode === "per_project" && newPeriod.project_id && (() => {
              const proj = projects.find((p: any) => p.id === newPeriod.project_id);
              return (
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.kpi.paymentPercent}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min={0} max={100}
                      value={newPeriod.payment_percent}
                      onChange={(e) => {
                        const pct = Math.min(100, Math.max(0, +e.target.value));
                        const fund = proj ? Math.round((proj.allocation_fund || 0) * pct / 100) : 0;
                        setNewPeriod({ ...newPeriod, payment_percent: pct, total_fund: fund });
                      }}
                      className="w-20 h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono text-center focus:border-primary focus:outline-none"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t.kpi.fundLabel} {formatVND(proj?.allocation_fund || 0)} × {newPeriod.payment_percent}% = <span className="font-bold text-primary">{formatVND(newPeriod.total_fund)}</span>
                  </p>
                </div>
              );
            })()}
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.fundManual}</label>
              <input
                type="number"
                value={newPeriod.total_fund || ""}
                onChange={(e) => setNewPeriod({ ...newPeriod, total_fund: +e.target.value })}
                placeholder="50000000"
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none"
                readOnly={newPeriod.mode === "per_project" && !!newPeriod.project_id}
              />
              {newPeriod.mode === "global" && (
                <p className="text-[11px] text-muted-foreground mt-1">{t.kpi.fundManualHint}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.startDate}</label>
              <input
                type="date"
                value={newPeriod.period_start}
                onChange={(e) => setNewPeriod({ ...newPeriod, period_start: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.endDate}</label>
              <input
                type="date"
                value={newPeriod.period_end}
                onChange={(e) => setNewPeriod({ ...newPeriod, period_end: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={createPeriod.isPending}>
              {createPeriod.isPending ? t.kpi.creatingPeriod : t.kpi.createAllocation}
            </Button>
          </div>
        </div>
      )}

      {/* Period List */}
      {visiblePeriods.length === 0 ? (
        <EmptyState icon="💰" title={t.kpi.noAllocation} subtitle={canApprove ? t.kpi.noAllocationSub : t.kpi.approvedAllocations} />
      ) : (
        <div className="space-y-6">
          {visiblePeriods.map((period) => (
            <div key={period.id} className="space-y-3">
              {/* Period Actions */}
              <div className="flex items-center gap-3">
                {(period.status === "draft" || period.status === "calculated") && canApprove && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => calculateAlloc.mutate({ periodId: period.id })}
                    disabled={calculateAlloc.isPending}
                  >
                    {calculateAlloc.isPending ? t.kpi.calculating : period.status === "calculated" ? t.kpi.recalculate : t.kpi.calculate}
                  </Button>
                )}
                {period.status === "calculated" && canApprove && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => approveAlloc.mutate(period.id)}
                    disabled={approveAlloc.isPending}
                  >
                    {approveAlloc.isPending ? t.kpi.approving : t.kpi.approve}
                  </Button>
                )}
                {user?.role === "admin" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { if (confirm(t.kpi.confirmDeletePeriod.replace("{name}", period.name))) deletePeriod.mutate(period.id); }}
                    disabled={deletePeriod.isPending}
                  >
                    {deletePeriod.isPending ? t.common.deleting : t.common.delete}
                  </Button>
                )}
              </div>

              {/* Results Table */}
              <AllocationTable period={period} results={period.results || []} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KPIConfig({ config, user }: { config: any; user: any }) {
  const { t } = useI18n();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const canEdit = user && ["admin", "leader"].includes(user.role);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    weight_volume: config?.weight_volume ?? 0.4,
    weight_quality: config?.weight_quality ?? 0.3,
    weight_difficulty: config?.weight_difficulty ?? 0.2,
    weight_ahead: config?.weight_ahead ?? 0.1,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      if (config?.id) {
        const { error } = await supabase.from("allocation_configs").update(values).eq("id", config.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
        if (!profile) throw new Error("Profile not found");
        const { error } = await supabase.from("allocation_configs").insert({
          org_id: profile.org_id,
          name: "Default Config",
          ...values,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kpiKeys.config() });
      toast.success(config ? "Updated!" : "Created!");
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const weights = [
    { key: "weight_volume", label: t.kpi.volumeLabel, color: "#38bdf8" },
    { key: "weight_quality", label: t.kpi.qualityLabel, color: "#10b981" },
    { key: "weight_difficulty", label: t.kpi.difficultyLabel, color: "#f59e0b" },
    { key: "weight_ahead", label: t.kpi.aheadLabel, color: "#8b5cf6" },
  ];

  const currentValues = editing ? form : (config || form);
  const total = weights.reduce((s, w) => s + Math.round((currentValues[w.key as keyof typeof form] || 0) * 100), 0);

  const handleSave = () => {
    if (Math.abs(total - 100) > 1) {
      toast.error("Total weights must equal 100%");
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">{config ? t.kpi.currentWeights : t.kpi.createConfig}</h3>
        {!editing && canEdit && (
          <Button variant="primary" onClick={() => { setEditing(true); if (config) setForm({ weight_volume: config.weight_volume, weight_quality: config.weight_quality, weight_difficulty: config.weight_difficulty, weight_ahead: config.weight_ahead }); }}>
            {config ? t.kpi.editConfig : t.kpi.createConfigBtn}
          </Button>
        )}
      </div>

      <Section title={t.kpi.allocationWeights}>
        <div className="p-5 space-y-4">
          {weights.map((w) => {
            const val = currentValues[w.key as keyof typeof form] || 0;
            return (
              <div key={w.key} className="flex items-center gap-4">
                <span className="text-base w-40 font-medium">{w.label}</span>
                {editing ? (
                  <>
                    <input
                      type="range"
                      min={0} max={100} step={5}
                      value={Math.round(val * 100)}
                      onChange={(e) => setForm({ ...form, [w.key]: parseInt(e.target.value) / 100 })}
                      className="flex-1 accent-primary"
                    />
                    <span className="font-mono text-base font-bold w-12 text-right" style={{ color: w.color }}>
                      {Math.round(val * 100)}%
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${val * 100}%`, background: w.color }} />
                    </div>
                    <span className="font-mono text-base font-bold w-12 text-right" style={{ color: w.color }}>
                      {Math.round(val * 100)}%
                    </span>
                  </>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-base font-semibold">{t.common.total}</span>
            <span className={`font-mono text-base font-bold ${total === 100 ? "text-green-500" : "text-destructive"}`}>
              {total}%
            </span>
          </div>
          {editing && (
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setEditing(false)}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t.common.saving : t.kpi.saveConfig}
              </Button>
            </div>
          )}
        </div>
      </Section>

      {config && (
        <Section title={t.kpi.formula}>
          <div className="p-5">
            <div className="bg-secondary rounded-xl p-4 font-mono text-base leading-relaxed">
              <p className="text-primary font-bold mb-2">KPI Score = Σ(Component × Weight)</p>
              <p className="text-muted-foreground">
                = KL×{Math.round(config.weight_volume * 100)}% + CL×{Math.round(config.weight_quality * 100)}% + ĐK×{Math.round(config.weight_difficulty * 100)}% + VTĐ×{Math.round(config.weight_ahead * 100)}%
              </p>
              <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm text-muted-foreground">
                <p>Variance (Δ) = Actual Score - Expected Score</p>
                <p>Δ ≥ +10 → <span className="text-green-500">{t.kpi.exceptionalFull}</span></p>
                <p>Δ ≥ 0 → <span className="text-blue-500">{t.kpi.exceededFull}</span></p>
                <p>Δ ≥ -10 → <span className="text-amber-500">{t.kpi.nearTargetFull}</span></p>
                <p>Δ &lt; -10 → <span className="text-red-500">{t.kpi.belowTargetFull}</span></p>
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
