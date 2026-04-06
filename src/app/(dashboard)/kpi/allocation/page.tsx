"use client";

import { useState, useMemo } from "react";
import {
  useAllocationPeriods, useCreateAllocationPeriod, useCalculateAllocation,
  useApproveAllocation, useDeleteAllocationPeriod,
  useFundSummary, useEmployeeBonus, useCalculateBonus,
} from "@/lib/hooks/use-kpi";
import { useProjects } from "@/lib/hooks/use-projects";
import { useAuthStore } from "@/lib/stores";
import { Section, Button, EmptyState } from "@/components/shared";
import { Coins, TrendingUp, TrendingDown, Zap, AlertTriangle } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { AllocationTable } from "@/components/kpi";
import { formatVND } from "@/lib/utils/kpi";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { AllocationPeriod, AllocationMode } from "@/lib/types";

const supabase = createClient();

function useCenters() {
  return useQuery({
    queryKey: ["centers"],
    queryFn: async () => {
      const { data } = await supabase.from("centers").select("id, name, code").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });
}

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name, code, center_id").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });
}

type ActiveTab = "fund" | "periods" | "bonus";

// Roles có quyền xem tất cả trung tâm (Tài chính kế toán + Ban LĐ)
const GLOBAL_VIEW_ROLES = ["admin", "leader", "director"];

export default function AllocationPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const canManage = !!user && GLOBAL_VIEW_ROLES.includes(user.role);
  // Xem toàn bộ: admin/leader/director. NV khác chỉ thấy TT mình.
  const canViewAll = canManage;

  const [tab, setTab] = useState<ActiveTab>("fund");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [selectedCenter, setSelectedCenter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  const { data: periods = [] } = useAllocationPeriods();
  const { data: fundSummaryAll = [] } = useFundSummary();
  const { data: bonusData = [] } = useEmployeeBonus(selectedPeriod || undefined);
  const { data: centers = [] } = useCenters();
  const { data: departments = [] } = useDepartments();
  const calcBonus = useCalculateBonus();

  // Lọc quỹ theo trung tâm: NV thường chỉ thấy TT của mình
  const userCenterId = user?.center_id as string | undefined;
  const effectiveCenter = canViewAll ? selectedCenter : (userCenterId || "none");

  const fundSummary = useMemo(() => {
    if (effectiveCenter === "all") return fundSummaryAll;
    // Tìm các PB thuộc trung tâm được chọn
    const deptIdsInCenter = new Set(
      departments.filter((d) => d.center_id === effectiveCenter).map((d) => d.id)
    );
    return fundSummaryAll.filter((f: any) => deptIdsInCenter.has(f.dept_id));
  }, [fundSummaryAll, effectiveCenter, departments]);

  // Auto-select first period when available
  if (!selectedPeriod && periods.length > 0) setSelectedPeriod(periods[0].id);

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: "fund", label: "Quỹ phòng ban" },
    { key: "periods", label: "Đợt khoán" },
    { key: "bonus", label: "Thưởng cá nhân" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header: tabs + period selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1" role="tablist">
          {tabs.map((v) => (
            <button key={v.key} onClick={() => setTab(v.key)} role="tab" aria-selected={tab === v.key}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${tab === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Lọc theo trung tâm — chỉ admin/LĐ thấy dropdown, NV thường tự lọc theo TT mình */}
          {tab === "fund" && canViewAll && centers.length > 0 && (
            <div className="w-52">
              <SearchSelect value={selectedCenter} onChange={setSelectedCenter}
                options={[
                  { value: "all", label: "Tất cả trung tâm" },
                  ...centers.map((c) => ({ value: c.id, label: `${c.code || ""} — ${c.name}` })),
                ]}
                placeholder="Lọc trung tâm" />
            </div>
          )}
          {(tab === "bonus" || tab === "periods") && periods.length > 0 && (
            <div className="w-56">
              <SearchSelect value={selectedPeriod} onChange={setSelectedPeriod}
                options={periods.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Chọn đợt khoán" />
            </div>
          )}
          {tab === "bonus" && selectedPeriod && canManage && (
            <Button variant="primary" size="sm" onClick={() => {
              calcBonus.mutate(selectedPeriod, {
                onSuccess: () => toast.success("Tính thưởng hoàn tất!"),
                onError: (e) => toast.error(e.message),
              });
            }} disabled={calcBonus.isPending}>
              <Zap size={13} className="mr-1" />
              {calcBonus.isPending ? "Đang tính..." : "Tính thưởng"}
            </Button>
          )}
          {tab === "periods" && canManage && (
            <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? t.common.cancel : t.kpi.createPeriod}
            </Button>
          )}
        </div>
      </div>

      {/* Hiện tên TT khi NV thường xem (không có dropdown) */}
      {tab === "fund" && !canViewAll && userCenterId && (() => {
        const c = centers.find((ct) => ct.id === userCenterId);
        return c ? <p className="text-sm text-muted-foreground">Trung tâm: <span className="font-semibold text-foreground">{c.name}</span></p> : null;
      })()}

      {/* ═══ Phần 1+2: Quỹ phòng ban — dự kiến vs thực tế ═══ */}
      {tab === "fund" && <FundSummarySection data={fundSummary} />}

      {/* ═══ Phần 3: Đợt khoán ═══ */}
      {tab === "periods" && (
        <PeriodsSection
          periods={periods} selectedPeriod={selectedPeriod}
          showForm={showForm} setShowForm={setShowForm}
          canManage={canManage} />
      )}

      {/* ═══ Phần 4: Thưởng cá nhân ═══ */}
      {tab === "bonus" && <BonusSection data={bonusData} periodId={selectedPeriod} />}
    </div>
  );
}

/* ─── Phần 1+2: Quỹ phòng ban dự kiến vs thực tế ───────────────── */

function FundSummarySection({ data }: { data: any[] }) {
  if (data.length === 0) return <EmptyState icon={<Coins size={32} strokeWidth={1.5} />} title="Chưa có dữ liệu quỹ" subtitle="Cần có hợp đồng active và phân bổ doanh thu" />;

  const totals = data.reduce((acc, d) => ({
    expected: acc.expected + Number(d.expected_fund),
    actual: acc.actual + Number(d.actual_revenue) + Number(d.internal_rev),
    costs: acc.costs + Number(d.total_costs),
    salary: acc.salary + Number(d.total_salary),
    net: acc.net + Number(d.net_fund),
  }), { expected: 0, actual: 0, costs: 0, salary: 0, net: 0 });

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Quỹ dự kiến", value: totals.expected, color: "text-blue-500" },
          { label: "DT thực tế", value: totals.actual, color: "text-green-500" },
          { label: "Chi phí", value: totals.costs, color: "text-red-400" },
          { label: "Đã trả lương", value: totals.salary, color: "text-yellow-500" },
          { label: "Còn lại", value: totals.net, color: totals.net >= 0 ? "text-green-500" : "text-red-500" },
        ].map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-lg font-bold font-mono ${c.color}`}>{formatVND(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Per-dept table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {["Phòng ban", "Quỹ dự kiến", "DT thực tế", "DT nội bộ", "Chi phí", "Lương", "Còn lại"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {data.map((d) => {
              const net = Number(d.net_fund);
              return (
                <tr key={d.dept_id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{d.dept_code} — {d.dept_name}</td>
                  <td className="px-4 py-2.5 font-mono text-blue-500">{formatVND(d.expected_fund)}</td>
                  <td className="px-4 py-2.5 font-mono text-green-500">{formatVND(d.actual_revenue)}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{formatVND(d.internal_rev)}</td>
                  <td className="px-4 py-2.5 font-mono text-red-400">{formatVND(d.total_costs)}</td>
                  <td className="px-4 py-2.5 font-mono text-yellow-500">{formatVND(d.total_salary)}</td>
                  <td className={`px-4 py-2.5 font-mono font-bold ${net >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatVND(net)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Phần 3: Đợt khoán (giữ logic cũ, gọn lại) ────────────────── */

function PeriodsSection({ periods, selectedPeriod, showForm, setShowForm, canManage }: {
  periods: AllocationPeriod[]; selectedPeriod: string;
  showForm: boolean; setShowForm: (v: boolean) => void; canManage: boolean;
}) {
  const { t } = useI18n();
  const { data: projects = [] } = useProjects();
  const createPeriod = useCreateAllocationPeriod();
  const calculateAlloc = useCalculateAllocation();
  const approveAlloc = useApproveAllocation();
  const deletePeriod = useDeleteAllocationPeriod();
  const { user } = useAuthStore();

  const [newPeriod, setNewPeriod] = useState({
    name: "", total_fund: 0, project_id: "", period_start: "", period_end: "", mode: "per_project" as AllocationMode,
  });

  const handleCreate = async () => {
    if (!newPeriod.name || !newPeriod.total_fund) { toast.error("Nhập tên và quỹ khoán"); return; }
    try {
      const submitData = { ...newPeriod, project_id: newPeriod.project_id || undefined };
      await createPeriod.mutateAsync(submitData as any);
      toast.success("Tạo đợt khoán thành công!");
      setShowForm(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = selectedPeriod ? periods.filter((p) => p.id === selectedPeriod) : periods;

  return (
    <div className="space-y-4">
      {showForm && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4 animate-slide-in-bottom">
          <h3 className="text-base font-bold text-primary">{t.kpi.createPeriodTitle}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground font-medium">{t.kpi.periodName}</label>
              <input value={newPeriod.name} onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Quỹ khoán</label>
              <input type="number" value={newPeriod.total_fund || ""} onChange={(e) => setNewPeriod({ ...newPeriod, total_fund: +e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Dự án</label>
              <SearchSelect value={newPeriod.project_id} onChange={(v) => setNewPeriod({ ...newPeriod, project_id: v })}
                options={[{ value: "", label: "— Tổng hợp —" }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
                className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.kpi.startDate}</label>
              <input type="date" value={newPeriod.period_start} onChange={(e) => setNewPeriod({ ...newPeriod, period_start: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.kpi.endDate}</label>
              <input type="date" value={newPeriod.period_end} onChange={(e) => setNewPeriod({ ...newPeriod, period_end: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={createPeriod.isPending}>
              {createPeriod.isPending ? t.kpi.creatingPeriod : t.kpi.createAllocation}
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={<Coins size={32} strokeWidth={1.5} />} title={t.kpi.noAllocation} subtitle={t.kpi.noAllocationSub} />
      ) : (
        filtered.map((period) => (
          <div key={period.id} className="space-y-3">
            <div className="flex items-center gap-2">
              {(period.status === "draft" || period.status === "calculated") && canManage && (
                <Button size="sm" variant="primary" onClick={() => calculateAlloc.mutate({ periodId: period.id })} disabled={calculateAlloc.isPending}>
                  {period.status === "calculated" ? t.kpi.recalculate : t.kpi.calculate}
                </Button>
              )}
              {period.status === "calculated" && canManage && (
                <Button size="sm" variant="primary" onClick={() => approveAlloc.mutate(period.id)}>{t.kpi.approve}</Button>
              )}
              {user?.role === "admin" && (
                <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Xoá đợt "${period.name}"?`)) deletePeriod.mutate(period.id); }}>
                  {t.common.delete}
                </Button>
              )}
            </div>
            <AllocationTable period={period} results={period.results || []} />
          </div>
        ))
      )}
    </div>
  );
}

/* ─── Phần 4: Thưởng cá nhân ─────────────────────────────────────── */

function BonusSection({ data, periodId }: { data: any[]; periodId: string }) {
  if (!periodId) return <EmptyState icon={<TrendingUp size={32} strokeWidth={1.5} />} title="Chọn đợt khoán" subtitle="Chọn 1 đợt khoán ở dropdown phía trên để xem bảng thưởng" />;
  if (data.length === 0) return <EmptyState icon={<TrendingUp size={32} strokeWidth={1.5} />} title="Chưa có dữ liệu thưởng" subtitle="Nhấn 'Tính thưởng' để tính cho đợt khoán này" />;

  const OUTCOME_STYLE: Record<string, string> = {
    bonus: "bg-green-500/10 text-green-600",
    deduction: "bg-red-500/10 text-red-500",
    balanced: "bg-secondary text-muted-foreground",
  };
  const OUTCOME_LABEL: Record<string, string> = { bonus: "Thưởng", deduction: "Khoán âm", balanced: "Hoà" };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {["Nhân viên", "Phòng ban", "Sản lượng", "Lương kỳ", "Thưởng / Nợ", "Còn nợ", "Kết quả"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {data.map((r) => {
            const diff = Number(r.allocated_amount) - Number(r.total_salary);
            return (
              <tr key={r.result_id} className={`hover:bg-secondary/20 transition-colors ${r.outcome === "deduction" ? "bg-red-500/5" : ""}`}>
                <td className="px-4 py-2.5 font-medium">{r.full_name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.dept_name || "—"}</td>
                <td className="px-4 py-2.5 font-mono text-green-500">{formatVND(r.allocated_amount)}</td>
                <td className="px-4 py-2.5 font-mono text-yellow-500">{formatVND(r.total_salary)}</td>
                <td className={`px-4 py-2.5 font-mono font-bold ${diff >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {diff >= 0 ? "+" : ""}{formatVND(diff)}
                </td>
                <td className="px-4 py-2.5 font-mono">
                  {r.deduction_remaining > 0 && (
                    <span className="text-red-500 flex items-center gap-0.5">
                      <AlertTriangle size={10} />{formatVND(r.deduction_remaining)}
                    </span>
                  )}
                  {r.deduction_remaining <= 0 && <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${OUTCOME_STYLE[r.outcome]}`}>
                    {OUTCOME_LABEL[r.outcome]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
