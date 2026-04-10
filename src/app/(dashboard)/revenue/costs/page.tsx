"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useProjects } from "@/features/projects";
import { useContracts } from "@/features/contracts";
import { useCostEntries, useCreateCostEntry, useDeleteCostEntry } from "@/features/revenue";
import { useSalaryRecords, useCreateSalaryBatch, useDeleteSalary, useSalaryDeductions } from "@/features/kpi";
import { useCenters } from "@/features/organization";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState, ConfirmDialog } from "@/components/shared";
import { BarChart3, Wallet, AlertTriangle, Download, Upload, ChevronDown, Trash2 } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { useI18n } from "@/lib/i18n";
import { formatVND, formatDate } from "@/lib/utils/format";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import * as XLSX from "xlsx";
import type { CostCategory } from "@/lib/types";

const supabase = createClient();

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name, code").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

function useDeptUsers(deptId?: string) {
  return useQuery({
    queryKey: ["dept-users", deptId],
    enabled: !!deptId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users").select("id, full_name, email, dept_id, employee_code")
        .eq("is_active", true).eq("dept_id", deptId!).order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

/** Tất cả user active — dùng cho nhập lương thủ công và import Excel */
function useAllActiveUsers() {
  return useQuery({
    queryKey: ["all-active-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users").select("id, full_name, email, dept_id, center_id, employee_code")
        .eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

type CostsTab = "costs" | "salary";

// Phân loại chi phí theo chuẩn kế toán VN
const CATEGORY_COLORS: Record<string, string> = {
  cogs: "#ef4444",       // Giá vốn hàng bán — đỏ (chi phí trực tiếp)
  selling: "#f59e0b",    // Chi phí bán hàng — cam
  admin: "#3b82f6",      // Chi phí QLDN — xanh dương
  financial: "#8b5cf6",  // Chi phí tài chính — tím
};

export default function CostsPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const canManage = !!user;
  const [activeTab, setActiveTab] = useState<CostsTab>("costs");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-1" role="tablist">
        {([
          { key: "costs" as const, label: "Chi phí" },
          { key: "salary" as const, label: "Lương" },
        ]).map(v => (
          <button key={v.key} onClick={() => setActiveTab(v.key)} role="tab" aria-selected={activeTab === v.key}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${activeTab === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {v.label}
          </button>
        ))}
      </div>

      {activeTab === "costs" && <CostsSection canManage={canManage} />}
      {activeTab === "salary" && <SalarySection canManage={canManage} />}
    </div>
  );
}

/* ─── Tab Chi phí ─────────────────────────────────────────────────── */

function CostsSection({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const { data: projects = [] } = useProjects();
  /* Chỉ hiện hợp đồng đầu ra (doanh thu), không bao gồm HĐ giao khoán */
  const { data: contracts = [] } = useContracts({ type: "outgoing" });
  const { data: departments = [] } = useDepartments();

  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const { data: costResult } = useCostEntries({
    projectId: filterProjectId || undefined,
    category: filterCategory || undefined,
  });
  const entries = costResult?.data ?? [];
  const create = useCreateCostEntry();
  const remove = useDeleteCostEntry();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    project_id: "" as string | null, contract_id: "" as string | null, dept_id: "" as string | null,
    category: "admin" as CostCategory, description: "", amount: 0, budget_amount: 0,
    period_start: "", period_end: "", notes: "",
  });

  const totalCost = useMemo(() => entries.reduce((s, e) => s + Number(e.amount), 0), [entries]);
  const totalBudget = useMemo(() => entries.reduce((s, e) => s + Number(e.budget_amount), 0), [entries]);
  const variance = totalBudget - totalCost;

  // Category summary
  const catSummary = useMemo(() => {
    const map: Record<string, { actual: number; budget: number }> = {};
    for (const e of entries) {
      if (!map[e.category]) map[e.category] = { actual: 0, budget: 0 };
      map[e.category].actual += Number(e.amount);
      map[e.category].budget += Number(e.budget_amount);
    }
    return map;
  }, [entries]);

  // Over-budget items
  const overBudgetCount = useMemo(() => entries.filter((e) => Number(e.budget_amount) > 0 && Number(e.amount) > Number(e.budget_amount)).length, [entries]);

  const handleCreate = async () => {
    if (!form.description || !form.amount) { toast.error("Nhập mô tả và số tiền"); return; }
    try {
      await create.mutateAsync({
        project_id: form.project_id || null,
        contract_id: form.contract_id || null,
        dept_id: form.dept_id || null,
        category: form.category,
        description: form.description,
        amount: form.amount,
        budget_amount: form.budget_amount,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        notes: form.notes || null,
      });
      toast.success("Ghi nhận chi phí thành công!");
      setShowForm(false);
      setForm({ project_id: "", contract_id: "", dept_id: "", category: "admin", description: "", amount: 0, budget_amount: 0, period_start: "", period_end: "", notes: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  const catLabel = (c: string) => (t.revenue as any)[`cat${c.charAt(0).toUpperCase() + c.slice(1)}`] || c;

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">{t.revenue.costsSub}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">{t.revenue.totalCost}</p>
          <p className="text-lg font-bold font-mono">{formatVND(totalCost)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">{t.revenue.totalBudget}</p>
          <p className="text-lg font-bold font-mono">{formatVND(totalBudget)}</p>
        </div>
        <div className={`bg-card border rounded-xl p-3 ${variance < 0 ? "border-destructive/50" : "border-border"}`}>
          <p className="text-[11px] text-muted-foreground">{t.revenue.variance}</p>
          <p className={`text-lg font-bold font-mono ${variance < 0 ? "text-destructive" : "text-primary"}`}>{variance >= 0 ? "+" : ""}{formatVND(variance)}</p>
          {overBudgetCount > 0 && <p className="text-[10px] text-destructive font-medium">{overBudgetCount} {t.revenue.overBudgetAlert}</p>}
        </div>
        {(["cogs", "selling"] as const).map((cat) => (
          <div key={cat} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">{catLabel(cat)}</p>
            <p className="text-sm font-bold font-mono" style={{ color: CATEGORY_COLORS[cat] }}>{formatVND(catSummary[cat]?.actual || 0)}</p>
          </div>
        ))}
      </div>

      {/* Filters + Action */}
      <div className="flex items-center gap-3">
        <div className="w-52">
          <SearchSelect value={filterProjectId} onChange={setFilterProjectId}
            options={[{ value: "", label: t.revenue.allProjects }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
            placeholder={t.revenue.selectProject} />
        </div>
        <div className="w-44">
          <SearchSelect value={filterCategory} onChange={setFilterCategory}
            options={[
              { value: "", label: t.revenue.allCategories },
              { value: "cogs", label: t.revenue.catCogs },
              { value: "selling", label: t.revenue.catSelling },
              { value: "admin", label: t.revenue.catAdmin },
              { value: "financial", label: t.revenue.catFinancial },
            ]} />
        </div>
        <div className="flex-1" />
        {canManage && (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            {t.revenue.newCost}
          </Button>
        )}
      </div>

      {/* Modal ghi nhận chi phí */}
      {showForm && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Tiêu đề */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
              <h3 className="text-base font-bold text-primary">{t.revenue.newCost}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
            </div>

            {/* Nội dung form */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.category}</label>
                  <SearchSelect value={form.category} onChange={(v) => setForm({ ...form, category: v as CostCategory })}
                    options={[
                      { value: "cogs", label: t.revenue.catCogs },
                      { value: "selling", label: t.revenue.catSelling },
                      { value: "admin", label: t.revenue.catAdmin },
                      { value: "financial", label: t.revenue.catFinancial },
                    ]} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.selectProject}</label>
                  <SearchSelect value={form.project_id || ""} onChange={(v) => setForm({ ...form, project_id: v || null })}
                    options={[{ value: "", label: "—" }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
                    className="mt-1" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.selectDept}</label>
                  <SearchSelect value={form.dept_id || ""} onChange={(v) => setForm({ ...form, dept_id: v || null })}
                    options={[{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))]}
                    className="mt-1" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.description} *</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.selectContract}</label>
                  <SearchSelect value={form.contract_id || ""} onChange={(v) => setForm({ ...form, contract_id: v || null })}
                    options={[{ value: "", label: "—" }, ...contracts.map((c: any) => ({ value: c.id, label: `${c.contract_no} — ${c.title}` }))]}
                    className="mt-1" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.actualAmount} *</label>
                  <input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.budgetAmount}</label>
                  <input type="number" min={0} value={form.budget_amount || ""} onChange={(e) => setForm({ ...form, budget_amount: +e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.periodStart}</label>
                  <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.periodEnd}</label>
                  <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.revenue.notes}</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-card rounded-b-2xl">
              <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={handleCreate} disabled={create.isPending}>
                {create.isPending ? t.revenue.creating : t.revenue.create}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {entries.length === 0 ? (
        <EmptyState icon={<BarChart3 size={32} strokeWidth={1.5} />} title={t.revenue.noCosts} subtitle={t.revenue.noCostsSub} />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.description}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.category}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.selectProject}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.selectDept}</th>
                <th className="text-right px-4 py-2.5 font-medium">{t.revenue.budgetAmount}</th>
                <th className="text-right px-4 py-2.5 font-medium">{t.revenue.actualAmount}</th>
                <th className="text-right px-4 py-2.5 font-medium">{t.revenue.variance}</th>
                {canManage && <th className="text-right px-4 py-2.5 font-medium w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {entries.map((e) => {
                const budget = Number(e.budget_amount);
                const actual = Number(e.amount);
                const diff = budget - actual;
                const isOver = budget > 0 && actual > budget;
                const color = CATEGORY_COLORS[e.category] || "#94a3b8";
                return (
                  <tr key={e.id} className={`hover:bg-secondary/20 transition-colors ${isOver ? "bg-destructive/5" : ""}`}>
                    <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{e.description}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${color}20`, color }}>{catLabel(e.category)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.project?.code || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.department?.code || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{budget > 0 ? formatVND(budget) : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(actual)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${isOver ? "text-destructive" : diff > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {budget > 0 ? `${diff >= 0 ? "+" : ""}${formatVND(diff)}` : "—"}
                    </td>
                    {canManage && (
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => { if (confirm(t.revenue.confirmDeleteCost)) remove.mutate(e.id); }} className="text-destructive hover:underline text-[10px]">{t.common.delete}</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/20">
                <td colSpan={4} className="px-4 py-2 font-bold">{t.revenue.totalCost}</td>
                <td className="px-4 py-2 text-right font-mono font-bold">{formatVND(totalBudget)}</td>
                <td className="px-4 py-2 text-right font-mono font-bold">{formatVND(totalCost)}</td>
                <td className={`px-4 py-2 text-right font-mono font-bold ${variance < 0 ? "text-destructive" : "text-primary"}`}>{variance >= 0 ? "+" : ""}{formatVND(variance)}</td>
                {canManage && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Tab Lương ───────────────────────────────────────────────────── */

function SalarySection({ canManage }: { canManage: boolean }) {
  const { data: departments = [] } = useDepartments();
  const { data: allCenters = [] } = useCenters();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [centerId, setCenterId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [salaryTab, setSalaryTab] = useState<"view" | "deductions">("view");
  const [showManualPopup, setShowManualPopup] = useState(false);
  const [showExcelPopup, setShowExcelPopup] = useState(false);

  /* Dropdown "Nhập lương" */
  const [inputMenuOpen, setInputMenuOpen] = useState(false);
  const inputMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputMenuRef.current && !inputMenuRef.current.contains(e.target as Node)) setInputMenuOpen(false);
    };
    if (inputMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [inputMenuOpen]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {([
          { key: "view" as const, label: "Lương tháng" },
          { key: "deductions" as const, label: "Công nợ khoán" },
        ]).map(v => (
          <button key={v.key} onClick={() => setSalaryTab(v.key)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${salaryTab === v.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
            {v.label}
          </button>
        ))}
        {/* Nút "Nhập lương" — dropdown chứa 2 chế độ nhập */}
        {canManage && (
          <div className="relative" ref={inputMenuRef}>
            <button
              onClick={() => setInputMenuOpen((o) => !o)}
              className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Nhập lương <ChevronDown size={12} className={`transition-transform ${inputMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {inputMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-50 py-1 animate-in fade-in-0 zoom-in-95 duration-100">
                <button
                  onClick={() => { setShowManualPopup(true); setInputMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
                >
                  <Wallet size={13} className="text-muted-foreground" /> Nhập thủ công
                </button>
                <button
                  onClick={() => { setShowExcelPopup(true); setInputMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
                >
                  <Upload size={13} className="text-muted-foreground" /> Chèn từ Excel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {salaryTab === "view" && <SalaryViewInner month={month} setMonth={setMonth} centerId={centerId} setCenterId={setCenterId} deptId={deptId} setDeptId={setDeptId} depts={departments} centers={allCenters as any[]} canManage={canManage} />}
      {salaryTab === "deductions" && <DeductionsInner />}

      {/* Popup nhập lương thủ công — kế thừa bộ lọc TT/PB từ view cha */}
      {showManualPopup && <SalaryManualPopup month={month} setMonth={setMonth} initCenterId={centerId} initDeptId={deptId} depts={departments} centers={allCenters as any[]} onClose={() => setShowManualPopup(false)} />}
      {/* Popup chèn lương từ Excel */}
      {showExcelPopup && <SalaryExcelPopup month={month} setMonth={setMonth} onClose={() => setShowExcelPopup(false)} />}
    </div>
  );
}

/* ── Tab "Lương tháng": xem bảng lương đã ghi nhận, lọc theo tháng / trung tâm / phòng ban ── */
function SalaryViewInner({ month, setMonth, centerId, setCenterId, deptId, setDeptId, depts, centers, canManage }: {
  month: string; setMonth: (v: string) => void;
  centerId: string; setCenterId: (v: string) => void;
  deptId: string; setDeptId: (v: string) => void;
  depts: { id: string; name: string; code: string; center_id?: string }[];
  centers: { id: string; name: string; code?: string; is_active?: boolean }[];
  canManage: boolean;
}) {
  /* Phòng ban phụ thuộc trung tâm đã chọn */
  const filteredDepts = useMemo(() => {
    if (!centerId) return depts;
    return depts.filter((d: any) => d.center_id === centerId);
  }, [depts, centerId]);

  const { data: existing } = useSalaryRecords({ month, dept_id: deptId || undefined });
  const salaryRows = existing?.data ?? [];
  const deleteSalary = useDeleteSalary();
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; name: string } | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  /* Lọc theo TT: bao gồm user có dept trong TT hoặc center_id trực tiếp */
  const visibleRows = useMemo(() => {
    if (deptId) return salaryRows;
    if (!centerId) return salaryRows;
    const deptIdsInCenter = new Set(filteredDepts.map((d) => d.id));
    return salaryRows.filter((r: any) =>
      deptIdsInCenter.has(r.dept_id) ||
      r.user?.center_id === centerId
    );
  }, [salaryRows, deptId, centerId, filteredDepts]);

  const rows = visibleRows.map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    full_name: r.user?.full_name ?? "—",
    employee_code: r.user?.employee_code ?? "",
    dept_name: r.department?.name ?? "",
    base: Number(r.base_salary ?? 0),
    deduction: Number(r.deduction_applied ?? 0),
    net: Number(r.net_salary ?? 0),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground font-medium">Tháng</label>
          <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")}
            className="mt-1 block h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
        </div>
        <div className="w-48">
          <label className="text-xs text-muted-foreground font-medium">Trung tâm</label>
          <select
            value={centerId}
            onChange={(e) => { setCenterId(e.target.value); setDeptId(""); }}
            className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Tất cả Trung tâm</option>
            {centers.filter((c) => c.is_active !== false).map((c) => (
              <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label className="text-xs text-muted-foreground font-medium">Phòng ban</label>
          <SearchSelect value={deptId} onChange={setDeptId}
            options={[{ value: "", label: "Tất cả Phòng ban" }, ...filteredDepts.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))]}
            className="mt-1" />
        </div>
        {(centerId || deptId) && (
          <button onClick={() => { setCenterId(""); setDeptId(""); }}
            className="self-end h-9 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Xóa lọc
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Wallet size={32} strokeWidth={1.5} />} title="Chưa có dữ liệu lương" subtitle="Chưa có bản ghi lương cho bộ lọc đã chọn" />
      ) : (
        <>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {canManage && rows.length > 0 && (
            <div className="flex justify-end px-4 py-2 border-b border-border">
              <button onClick={() => setShowDeleteAll(true)}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors">
                <Trash2 size={13} /> Xóa tất cả lương tháng này
              </button>
            </div>
          )}
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-muted-foreground">
              {["Mã HT", "Nhân viên", "Phòng ban", "Lương tháng", "Đã khấu trừ", "Thực nhận", ...(canManage ? [""] : [])].map(h => (
                <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-border/30">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.employee_code || "—"}</td>
                  <td className="px-4 py-2.5 font-medium">{r.full_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.dept_name || "—"}</td>
                  <td className="px-4 py-2.5 font-mono">{formatVND(r.base)}</td>
                  <td className="px-4 py-2.5 font-mono text-red-400">{r.deduction > 0 ? `-${formatVND(r.deduction)}` : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-green-500">{formatVND(r.net)}</td>
                  {canManage && (
                    <td className="px-4 py-2.5">
                      <button onClick={() => setDeleteTarget({ userId: r.user_id, name: r.full_name })}
                        className="text-red-400 hover:text-red-500 transition-colors" title="Xóa">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-border bg-secondary/20">
              <td colSpan={3} className="px-4 py-2 font-bold">Tổng ({rows.length} NV)</td>
              <td className="px-4 py-2 font-mono font-bold">{formatVND(rows.reduce((s, r) => s + r.base, 0))}</td>
              <td className="px-4 py-2 font-mono font-bold text-red-400">{formatVND(rows.reduce((s, r) => s + r.deduction, 0))}</td>
              <td className="px-4 py-2 font-mono font-bold text-green-500">{formatVND(rows.reduce((s, r) => s + r.net, 0))}</td>
              {canManage && <td />}
            </tr></tfoot>
          </table>
        </div>

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title={`Xóa lương của "${deleteTarget?.name}"?`}
          description={`Xóa bản ghi lương tháng ${month.slice(0, 7)} của nhân viên này.`}
          confirmLabel="Xóa"
          loading={deleteSalary.isPending}
          onConfirm={() => {
            if (!deleteTarget) return;
            deleteSalary.mutate({ month, userIds: [deleteTarget.userId] }, {
              onSuccess: () => { toast.success(`Đã xóa lương của "${deleteTarget.name}"`); setDeleteTarget(null); },
              onError: (err: any) => toast.error(err.message),
            });
          }}
        />

        <ConfirmDialog
          open={showDeleteAll}
          onOpenChange={setShowDeleteAll}
          title={`Xóa toàn bộ lương tháng ${month.slice(0, 7)}?`}
          description={`${rows.length} bản ghi lương sẽ bị xóa vĩnh viễn.\nHành động này không thể hoàn tác!`}
          confirmLabel="Xóa tất cả"
          loading={deleteSalary.isPending}
          onConfirm={() => {
            const userIds = rows.map((r) => r.user_id);
            deleteSalary.mutate({ month, userIds }, {
              onSuccess: (res) => { toast.success(`Đã xóa ${res.deleted} bản ghi lương`); setShowDeleteAll(false); },
              onError: (err: any) => toast.error(err.message),
            });
          }}
        />
        </>
      )}
    </div>
  );
}

/* ── Popup nhập lương thủ công: lọc TT/PB → nhập từng nhân sự ── */
function SalaryManualPopup({ month, setMonth, initCenterId, initDeptId, depts, centers, onClose }: {
  month: string; setMonth: (v: string) => void;
  initCenterId: string; initDeptId: string;
  depts: { id: string; name: string; code: string; center_id?: string }[];
  centers: { id: string; name: string; code?: string; is_active?: boolean }[];
  onClose: () => void;
}) {
  const { data: allUsers = [] } = useAllActiveUsers();
  const { data: existing } = useSalaryRecords({ month });
  const createBatch = useCreateSalaryBatch();
  const existingMap = new Map((existing?.data ?? []).map((r: any) => [r.user_id, r]));
  const [rows, setRows] = useState<Record<string, number>>({});
  const [popupCenter, setPopupCenter] = useState(initCenterId);
  const [popupDept, setPopupDept] = useState(initDeptId);

  const filteredDepts = useMemo(() => {
    if (!popupCenter) return depts;
    return depts.filter((d: any) => d.center_id === popupCenter);
  }, [depts, popupCenter]);

  /* Lọc nhân sự: theo PB, hoặc theo TT (qua dept + center_id trực tiếp) */
  const visibleUsers = useMemo(() => {
    let list = allUsers;
    if (popupDept) {
      list = list.filter((u) => u.dept_id === popupDept);
    } else if (popupCenter) {
      const deptIds = new Set(filteredDepts.map((d) => d.id));
      list = list.filter((u) =>
        u.center_id === popupCenter ||
        (u.dept_id && deptIds.has(u.dept_id))
      );
    }
    return list;
  }, [allUsers, popupDept, popupCenter, filteredDepts]);

  const hasFilter = !!(popupCenter || popupDept);

  const effectiveRows = visibleUsers.map((u) => ({
    user_id: u.id, full_name: u.full_name, employee_code: u.employee_code,
    dept_id: u.dept_id,
    hasCode: !!u.employee_code,
    current: existingMap.get(u.id)?.base_salary ?? 0,
    input: rows[u.id] ?? (existingMap.get(u.id)?.base_salary ?? 0),
  }));

  const handleSave = async () => {
    const records = effectiveRows
      .filter((r) => r.hasCode && r.input > 0)
      .map((r) => ({ user_id: r.user_id, dept_id: r.dept_id || undefined, month, base_salary: r.input }));
    if (records.length === 0) { toast.error("Không có dữ liệu lương để lưu"); return; }
    try {
      await createBatch.mutateAsync(records);
      toast.success(`Lưu lương ${records.length} nhân sự`);
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  const inputClass = "w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Nhập lương thủ công</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>

        {/* Bộ lọc */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-3 flex-wrap">
          <div className="w-36">
            <label className="text-xs text-muted-foreground font-medium">Tháng</label>
            <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")} className={"mt-1 " + inputClass} />
          </div>
          <div className="w-44">
            <label className="text-xs text-muted-foreground font-medium">Trung tâm</label>
            <select value={popupCenter} onChange={(e) => { setPopupCenter(e.target.value); setPopupDept(""); }} className={"mt-1 " + inputClass}>
              <option value="">Tất cả Trung tâm</option>
              {centers.filter((c) => c.is_active !== false).map((c) => (
                <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-44">
            <label className="text-xs text-muted-foreground font-medium">Phòng ban</label>
            <SearchSelect value={popupDept} onChange={setPopupDept}
              options={[{ value: "", label: "Tất cả PB" }, ...filteredDepts.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))]}
              className="mt-1" />
          </div>
        </div>

        {/* Bảng nhập lương */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {!hasFilter ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chọn trung tâm hoặc phòng ban để nhập lương</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border text-muted-foreground">
                {["Mã HT", "Nhân viên", "Lương hiện tại", "Lương mới"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-border/30">
                {effectiveRows.map((r) => (
                  <tr key={r.user_id} className={`transition-colors ${r.hasCode ? "hover:bg-secondary/20" : "opacity-40"}`}>
                    <td className="px-3 py-2 font-mono text-xs">{r.employee_code || <span className="text-muted-foreground italic">—</span>}</td>
                    <td className="px-3 py-2 font-medium">{r.full_name}</td>
                    <td className="px-3 py-2 font-mono">{formatVND(r.current)}</td>
                    <td className="px-3 py-2">
                      {r.hasCode ? (
                        <input type="number" min={0} value={r.input || ""} onChange={(e) => setRows({ ...rows, [r.user_id]: +e.target.value })}
                          className="w-32 h-7 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none" />
                      ) : (
                        <span className="text-muted-foreground italic text-[10px]">Cần Mã HT</span>
                      )}
                    </td>
                  </tr>
                ))}
                {effectiveRows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Không có nhân viên</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSave} disabled={createBatch.isPending || !hasFilter}>
            {createBatch.isPending ? "Đang lưu..." : "Lưu lương"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Popup chèn lương từ Excel: đọc cột B (mã) + cột S (lương), preview, lưu ── */
function SalaryExcelPopup({ month, setMonth, onClose }: {
  month: string; setMonth: (v: string) => void;
  onClose: () => void;
}) {
  const { data: allUsers = [] } = useAllActiveUsers();
  const createBatch = useCreateSalaryBatch();
  const fileRef = useRef<HTMLInputElement>(null);

  /* Map employee_code → user để khớp từng dòng Excel */
  const codeToUser = useMemo(() => {
    const map = new Map<string, typeof allUsers[0]>();
    for (const u of allUsers) {
      if (u.employee_code) map.set(u.employee_code.trim().toUpperCase(), u);
    }
    return map;
  }, [allUsers]);

  const [excelPreview, setExcelPreview] = useState<{
    matched: { code: string; name: string; userId: string; deptId: string | null; salary: number }[];
    unmatched: { code: string; salary: number }[];
  } | null>(null);

  /* Đọc bảng lương Excel theo vị trí cột cố định:
     - Cột B (index 1): Mã hệ thống — chỉ lấy dòng bắt đầu bằng "DC" hoặc "A2Z"
     - Cột S (index 18): Lương theo ngày công thực tế */
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      const matched: NonNullable<typeof excelPreview>["matched"] = [];
      const unmatched: { code: string; salary: number }[] = [];

      for (const row of rawRows) {
        const rawCode = String(row[1] ?? "").trim().toUpperCase();
        if (!rawCode) continue;
        if (!rawCode.startsWith("DC") && !rawCode.startsWith("A2Z")) continue;

        const salary = Number(row[18] ?? 0);
        if (salary <= 0) continue;

        const user = codeToUser.get(rawCode);
        if (user) {
          matched.push({ code: rawCode, name: user.full_name, userId: user.id, deptId: user.dept_id, salary });
        } else {
          unmatched.push({ code: rawCode, salary });
        }
      }

      setExcelPreview({ matched, unmatched });
      toast.success(`Đọc ${matched.length} nhân sự khớp mã, ${unmatched.length} không khớp`);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!excelPreview || excelPreview.matched.length === 0) { toast.error("Không có dữ liệu lương để lưu"); return; }
    const records = excelPreview.matched.map((r) => ({
      user_id: r.userId, dept_id: r.deptId || undefined, month, base_salary: r.salary,
    }));
    try {
      await createBatch.mutateAsync(records);
      toast.success(`Lưu lương ${records.length} nhân sự`);
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Chèn lương từ Excel</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>

        {/* Bộ lọc tháng + chọn file */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-3">
          <div className="w-36">
            <label className="text-xs text-muted-foreground font-medium">Tháng</label>
            <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")}
              className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
          </div>
          <div className="self-end">
            <button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-xs flex items-center gap-1 transition-colors text-primary font-medium">
              <Upload size={13} /> Chọn file Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
          </div>
        </div>

        {/* Nội dung: hướng dẫn hoặc preview */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {!excelPreview ? (
            <div className="py-10 text-center space-y-2">
              <Upload size={32} strokeWidth={1.2} className="mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Đọc <strong>cột B</strong> (Mã HT, bắt đầu bằng DC hoặc A2Z) và <strong>cột S</strong> (Lương theo ngày công thực tế).
              </p>
              <p className="text-xs text-muted-foreground">Tên nhân sự tự động lấy từ tài khoản khớp mã.</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                <div className="bg-green-500/10 text-green-600 px-3 py-1.5 rounded-lg text-xs font-medium">
                  {excelPreview.matched.length} nhân sự khớp mã
                </div>
                {excelPreview.unmatched.length > 0 && (
                  <div className="bg-yellow-500/10 text-yellow-600 px-3 py-1.5 rounded-lg text-xs font-medium">
                    {excelPreview.unmatched.length} mã không tìm thấy
                  </div>
                )}
              </div>

              {excelPreview.matched.length > 0 && (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    {["Mã HT", "Nhân viên", "Lương theo ngày công thực tế"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-medium">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-border/30">
                    {excelPreview.matched.map((r) => (
                      <tr key={r.userId} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-3 py-2 font-mono">{r.code}</td>
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-primary">{formatVND(r.salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t border-border bg-secondary/20">
                    <td colSpan={2} className="px-3 py-2 font-bold">Tổng</td>
                    <td className="px-3 py-2 font-mono font-bold text-primary">{formatVND(excelPreview.matched.reduce((s, r) => s + r.salary, 0))}</td>
                  </tr></tfoot>
                </table>
              )}

              {excelPreview.unmatched.length > 0 && (
                <details className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl overflow-hidden">
                  <summary className="px-3 py-2 text-xs font-medium text-yellow-600 cursor-pointer">
                    {excelPreview.unmatched.length} mã không tìm thấy trong hệ thống
                  </summary>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-yellow-500/10">
                      {excelPreview.unmatched.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-mono">{r.code}</td>
                          <td className="px-3 py-1.5 font-mono text-right">{formatVND(r.salary)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSave} disabled={createBatch.isPending || !excelPreview?.matched.length}>
            {createBatch.isPending ? "Đang lưu..." : "Lưu lương"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeductionsInner() {
  const { data: res } = useSalaryDeductions();
  const deductions = res?.data ?? [];
  if (deductions.length === 0) return <EmptyState icon={<AlertTriangle size={32} strokeWidth={1.5} />} title="Không có công nợ" subtitle="Công nợ phát sinh khi khoán âm (sản lượng < lương)" />;
  const STATUS_STYLE: Record<string, string> = { active: "bg-yellow-500/10 text-yellow-600", completed: "bg-green-500/10 text-green-600", cancelled: "bg-secondary text-muted-foreground" };
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-border text-muted-foreground">
          {["Mã HT", "Nhân viên", "Thời gian", "Đợt khoán", "Công nợ khoán", "Còn lại", "Trừ/tháng", "Trạng thái"].map(h => (
            <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
          ))}
        </tr></thead>
        <tbody className="divide-y divide-border/30">
          {deductions.map((d: any) => (
            <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
              <td className="px-4 py-2.5 font-mono text-xs">{d.user?.employee_code || "—"}</td>
              <td className="px-4 py-2.5 font-medium">{d.user?.full_name ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {d.period?.period_start && d.period?.period_end
                  ? `${formatDate(d.period.period_start)} — ${formatDate(d.period.period_end)}`
                  : "—"}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{d.period?.name ?? "—"}</td>
              <td className="px-4 py-2.5 font-mono text-red-400">{formatVND(d.total_amount)}</td>
              <td className="px-4 py-2.5 font-mono font-bold text-red-500">{formatVND(d.remaining_amount)}</td>
              <td className="px-4 py-2.5 font-mono">{formatVND(d.monthly_deduction)}</td>
              <td className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[d.status]}`}>
                {{ active: "Đang trừ", completed: "Đã trừ hết", cancelled: "Đã huỷ" }[d.status as string]}
              </span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
