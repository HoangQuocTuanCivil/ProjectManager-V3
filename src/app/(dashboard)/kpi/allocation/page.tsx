"use client";

import { useState, useMemo } from "react";
import {
  useAllocationPeriods, useCreateAllocationPeriod, useCalculateAllocation,
  useApproveAllocation, useDeleteAllocationPeriod,
  useFundSummary, useEmployeeBonus, useCalculateBonus, usePreviewFund,
} from "@/features/kpi";
import { useProjects } from "@/lib/hooks/use-projects";
import { useAuthStore } from "@/lib/stores";
import { Section, Button, EmptyState } from "@/components/shared";
import { Coins, TrendingUp, TrendingDown, Zap, AlertTriangle } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { AllocationTable } from "@/components/kpi";
import { formatVND } from "@/lib/utils/kpi";
import { currentMonthRange } from "@/lib/utils/format";
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
      const { data } = await supabase.from("departments").select("id, name, code, center_id, is_executive").eq("is_active", true).order("sort_order");
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

  const [tab, setTab] = useState<ActiveTab>("fund");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [selectedCenter, setSelectedCenter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const { start: monthStart, end: monthEnd } = currentMonthRange();
  const [fundStartDate, setFundStartDate] = useState(monthStart);
  const [fundEndDate, setFundEndDate] = useState(monthEnd);

  const { data: periods = [] } = useAllocationPeriods();
  const fundFilters = useMemo(() => {
    const f: { start_date?: string; end_date?: string } = {};
    if (fundStartDate) f.start_date = fundStartDate;
    if (fundEndDate) f.end_date = fundEndDate;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [fundStartDate, fundEndDate]);
  const { data: fundSummaryAll = [] } = useFundSummary(fundFilters);
  const { data: bonusData = [] } = useEmployeeBonus(selectedPeriod || undefined);
  const { data: centers = [] } = useCenters();
  const { data: departments = [] } = useDepartments();
  const calcBonus = useCalculateBonus();

  // Ban điều hành (is_executive): nhân sự thuộc PB này cũng xem được toàn bộ TT
  const userDeptIsExecutive = !!user?.dept_id && departments.some(
    (d) => d.id === user.dept_id && d.is_executive
  );
  // Xem toàn bộ: admin/leader/director HOẶC thuộc Ban điều hành
  const canViewAll = canManage || userDeptIsExecutive;

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
          {/* Lọc ngày + trung tâm cho tab Quỹ phòng ban */}
          {tab === "fund" && (
            <div className="flex items-center gap-2">
              <input type="date" value={fundStartDate} onChange={(e) => setFundStartDate(e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-border bg-card text-xs focus:border-primary focus:outline-none"
                title="Từ ngày" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="date" value={fundEndDate} onChange={(e) => setFundEndDate(e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-border bg-card text-xs focus:border-primary focus:outline-none"
                title="Đến ngày" />
              {(fundStartDate || fundEndDate) && (
                <button onClick={() => { setFundStartDate(""); setFundEndDate(""); }}
                  className="h-9 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  Xóa
                </button>
              )}
            </div>
          )}
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
            <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
              {t.kpi.createPeriod}
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
          canManage={canManage} centers={centers} />
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

function PeriodsSection({ periods, selectedPeriod, showForm, setShowForm, canManage, centers }: {
  periods: AllocationPeriod[]; selectedPeriod: string;
  showForm: boolean; setShowForm: (v: boolean) => void; canManage: boolean;
  centers: { id: string; name: string; code: string | null }[];
}) {
  const { t } = useI18n();
  const { data: projects = [] } = useProjects();
  const createPeriod = useCreateAllocationPeriod();
  const calculateAlloc = useCalculateAllocation();
  const approveAlloc = useApproveAllocation();
  const deletePeriod = useDeleteAllocationPeriod();
  const { user } = useAuthStore();

  /* ── Form state ── */
  const defRange = currentMonthRange();
  const [form, setForm] = useState({
    name: "", center_id: "", project_id: "",
    period_start: defRange.start, period_end: defRange.end,
  });
  const [factors, setFactors] = useState<Record<string, number>>({});

  /* Preview quỹ khoán từ nghiệm thu */
  const { data: preview = [] } = usePreviewFund({
    center_id: form.center_id || undefined,
    start_date: form.period_start || undefined,
    end_date: form.period_end || undefined,
    project_id: form.project_id || undefined,
  });

  /* Tính total_fund = SUM(NT × hệ số) */
  const totalFund = useMemo(() => {
    return preview.reduce((s, p) => {
      const factor = factors[p.project_id] ?? 1.0;
      return s + p.total_accepted * factor;
    }, 0);
  }, [preview, factors]);

  const handleCreate = async () => {
    if (!form.name) { toast.error("Nhập tên đợt"); return; }
    if (!form.center_id) { toast.error("Chọn trung tâm"); return; }
    if (!form.period_start || !form.period_end) { toast.error("Nhập ngày bắt đầu và kết thúc"); return; }
    if (totalFund <= 0) { toast.error("Quỹ khoán phải > 0 (cần có nghiệm thu trong kỳ)"); return; }
    try {
      const submitData: any = {
        name: form.name,
        center_id: form.center_id,
        project_id: form.project_id || undefined,
        period_start: form.period_start,
        period_end: form.period_end,
        total_fund: Math.round(totalFund),
        mode: form.project_id ? "per_project" : "global",
      };
      const period = await createPeriod.mutateAsync(submitData);
      /* Lưu hệ số dự án cho đợt khoán vừa tạo */
      if (period?.id && preview.length > 0) {
        const rows = preview
          .filter((p) => (factors[p.project_id] ?? 1.0) !== 1.0)
          .map((p) => ({ period_id: period.id, project_id: p.project_id, difficulty_factor: factors[p.project_id] }));
        if (rows.length > 0) {
          const supabase = createClient();
          await supabase.from("period_project_factors" as any).insert(rows);
        }
      }
      toast.success("Tạo đợt khoán thành công!");
      setShowForm(false);
      setForm({ name: "", center_id: "", project_id: "", period_start: "", period_end: "" });
      setFactors({});
    } catch (e: any) { toast.error(e.message); }
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none";

  const filtered = selectedPeriod ? periods.filter((p) => p.id === selectedPeriod) : periods;

  return (
    <div className="space-y-4">
      {/* Modal tạo đợt khoán */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-bold text-primary">{t.kpi.createPeriodTitle}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Hàng 1: Tên đợt */}
              <div>
                <label className="text-xs text-muted-foreground font-medium">{t.kpi.periodName}</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Khoán Q1-2026 TT Thiết kế" className={inputClass} />
              </div>

              {/* Hàng 2: Bắt đầu + Kết thúc */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">{t.kpi.startDate}</label>
                  <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">{t.kpi.endDate}</label>
                  <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className={inputClass} />
                </div>
              </div>

              {/* Hàng 3: Trung tâm + Dự án */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Trung tâm *</label>
                  <SearchSelect value={form.center_id} onChange={(v) => setForm({ ...form, center_id: v })}
                    options={centers.map((c) => ({ value: c.id, label: `${c.code || ""} — ${c.name}` }))}
                    placeholder="Chọn trung tâm" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Dự án</label>
                  <SearchSelect value={form.project_id} onChange={(v) => setForm({ ...form, project_id: v })}
                    options={[{ value: "", label: "— Tổng hợp —" }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
                    className="mt-1" />
                </div>
              </div>

              {/* Bảng preview nghiệm thu → quỹ khoán */}
              {form.center_id && form.period_start && form.period_end && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Nghiệm thu trong kỳ → Quỹ khoán</p>
                  {preview.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">Không có nghiệm thu nào trong khoảng thời gian này</p>
                  ) : (
                    <div className="bg-secondary/30 rounded-xl overflow-hidden border border-border/50">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left px-3 py-2 font-medium">Dự án</th>
                          <th className="text-left px-3 py-2 font-medium">HĐ Giao khoán</th>
                          <th className="text-right px-3 py-2 font-medium">Tổng NT trong kỳ</th>
                          <th className="text-center px-3 py-2 font-medium w-20">Hệ số</th>
                          <th className="text-right px-3 py-2 font-medium">Quỹ (NT×HS)</th>
                        </tr></thead>
                        <tbody className="divide-y divide-border/30">
                          {preview.map((p) => {
                            const factor = factors[p.project_id] ?? 1.0;
                            return (
                              <tr key={p.project_id} className="hover:bg-secondary/20">
                                <td className="px-3 py-2 font-medium">{p.project_code} — {p.project_name}</td>
                                <td className="px-3 py-2 text-muted-foreground">{p.allocations.map((a) => a.allocation_code || "—").join(", ")}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatVND(p.total_accepted)}</td>
                                <td className="px-3 py-2 text-center">
                                  <input type="number" step="0.1" min="0.1" value={factor}
                                    onChange={(e) => setFactors({ ...factors, [p.project_id]: parseFloat(e.target.value) || 1.0 })}
                                    className="w-16 h-6 px-1.5 rounded border border-border bg-card text-xs font-mono text-center focus:border-primary focus:outline-none" />
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-primary">{formatVND(p.total_accepted * factor)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot><tr className="border-t border-border bg-secondary/30">
                          <td colSpan={4} className="px-3 py-2 font-bold">Tổng quỹ khoán</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-primary">{formatVND(totalFund)}</td>
                        </tr></tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={handleCreate} disabled={createPeriod.isPending}>
                {createPeriod.isPending ? t.kpi.creatingPeriod : t.kpi.createAllocation}
              </Button>
            </div>
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
