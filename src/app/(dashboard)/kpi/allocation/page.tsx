"use client";

import { useState } from "react";
import { useAllocationPeriods, useCreateAllocationPeriod, useCalculateAllocation, useApproveAllocation, useDeleteAllocationPeriod } from "@/lib/hooks/use-kpi";
import { useProjects } from "@/lib/hooks/use-projects";
import { useAuthStore } from "@/lib/stores";
import { Section, Button, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { AllocationTable } from "@/components/kpi";
import { formatVND } from "@/lib/utils/kpi";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import type { AllocationPeriod, AllocationMode } from "@/lib/types";

/**
 * Allocation Periods page — create, calculate, approve, and review
 * allocation periods where completed tasks are scored and funds distributed.
 */
export default function AllocationPage() {
  const { t } = useI18n();
  const { data: periods = [] } = useAllocationPeriods();
  const { data: projects = [] } = useProjects();
  const { user } = useAuthStore();
  const createPeriod = useCreateAllocationPeriod();
  const calculateAlloc = useCalculateAllocation();
  const approveAlloc = useApproveAllocation();
  const deletePeriod = useDeleteAllocationPeriod();
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
  const visiblePeriods = canApprove ? periods : periods.filter((p) => p.status === "approved");

  return (
    <div className="space-y-5 animate-fade-in">
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
                    const proj = projects.find((p: any) => p.id === val);
                    const fund = proj ? Math.round((proj.allocation_fund || 0) * newPeriod.payment_percent / 100) : 0;
                    setNewPeriod({ ...newPeriod, project_id: val, total_fund: fund });
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
              <input type="date" value={newPeriod.period_start} onChange={(e) => setNewPeriod({ ...newPeriod, period_start: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.endDate}</label>
              <input type="date" value={newPeriod.period_end} onChange={(e) => setNewPeriod({ ...newPeriod, period_end: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
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
              <div className="flex items-center gap-3">
                {(period.status === "draft" || period.status === "calculated") && canApprove && (
                  <Button size="sm" variant="primary" onClick={() => calculateAlloc.mutate({ periodId: period.id })} disabled={calculateAlloc.isPending}>
                    {calculateAlloc.isPending ? t.kpi.calculating : period.status === "calculated" ? t.kpi.recalculate : t.kpi.calculate}
                  </Button>
                )}
                {period.status === "calculated" && canApprove && (
                  <Button size="sm" variant="primary" onClick={() => approveAlloc.mutate(period.id)} disabled={approveAlloc.isPending}>
                    {approveAlloc.isPending ? t.kpi.approving : t.kpi.approve}
                  </Button>
                )}
                {user?.role === "admin" && (
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm(t.kpi.confirmDeletePeriod.replace("{name}", period.name))) deletePeriod.mutate(period.id); }} disabled={deletePeriod.isPending}>
                    {deletePeriod.isPending ? t.common.deleting : t.common.delete}
                  </Button>
                )}
              </div>
              <AllocationTable period={period} results={period.results || []} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
