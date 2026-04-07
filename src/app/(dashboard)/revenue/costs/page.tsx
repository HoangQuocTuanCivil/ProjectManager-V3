"use client";

import { useState, useMemo, useRef } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useCostEntries, useCreateCostEntry, useDeleteCostEntry } from "@/lib/hooks/use-revenue";
import { useSalaryRecords, useCreateSalaryBatch, useSalaryDeductions } from "@/features/kpi";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { BarChart3, Wallet, AlertTriangle, Download, Upload } from "lucide-react";
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
        .from("users").select("id, full_name, email, dept_id")
        .eq("is_active", true).eq("dept_id", deptId!).order("full_name");
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
  const canManage = !!user && ["admin", "leader", "director"].includes(user.role);
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
  const { data: contracts = [] } = useContracts();
  const { data: departments = [] } = useDepartments();

  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const { data: entries = [] } = useCostEntries({
    projectId: filterProjectId || undefined,
    category: filterCategory || undefined,
  });
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
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [deptId, setDeptId] = useState("");
  const [salaryTab, setSalaryTab] = useState<"input" | "deductions">("input");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {([
          { key: "input" as const, label: "Lương tháng" },
          { key: "deductions" as const, label: "Công nợ khoán" },
        ]).map(v => (
          <button key={v.key} onClick={() => setSalaryTab(v.key)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${salaryTab === v.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
            {v.label}
          </button>
        ))}
      </div>
      {salaryTab === "input" && <SalaryInputInner month={month} setMonth={setMonth} deptId={deptId} setDeptId={setDeptId} depts={departments} canManage={canManage} />}
      {salaryTab === "deductions" && <DeductionsInner />}
    </div>
  );
}

function SalaryInputInner({ month, setMonth, deptId, setDeptId, depts, canManage }: {
  month: string; setMonth: (v: string) => void;
  deptId: string; setDeptId: (v: string) => void;
  depts: { id: string; name: string; code: string }[];
  canManage: boolean;
}) {
  const { data: users = [] } = useDeptUsers(deptId || undefined);
  const { data: existing } = useSalaryRecords({ month, dept_id: deptId || undefined });
  const createBatch = useCreateSalaryBatch();
  const fileRef = useRef<HTMLInputElement>(null);
  const existingMap = new Map((existing?.data ?? []).map((r: any) => [r.user_id, r]));
  const [rows, setRows] = useState<Record<string, number>>({});

  const handleDownloadTemplate = () => {
    if (!deptId || users.length === 0) { toast.error("Chọn PB có nhân viên trước"); return; }
    const dept = depts.find((d) => d.id === deptId);
    const headers = ["user_id", "Họ tên", "Email", "Lương cơ bản (VNĐ)"];
    const dataRows = users.map((u) => [u.id, u.full_name, u.email || "", existingMap.get(u.id)?.base_salary ?? 0]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws["!cols"] = [{ wch: 40 }, { wch: 25 }, { wch: 30 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lương tháng");
    XLSX.writeFile(wb, `Luong_${dept?.code || "PB"}_${month.slice(0, 7)}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      const newRows: Record<string, number> = {};
      let imported = 0;
      for (const row of jsonRows) {
        const uid = row["user_id"] || "";
        const salary = Number(row["Lương cơ bản (VNĐ)"] || row["base_salary"] || 0);
        if (uid && salary > 0) { newRows[uid] = salary; imported++; }
      }
      setRows(newRows);
      toast.success(`Import ${imported} bản ghi`);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const effectiveRows = users.map((u) => ({
    user_id: u.id, full_name: u.full_name,
    current: existingMap.get(u.id)?.base_salary ?? 0,
    deduction: existingMap.get(u.id)?.deduction_applied ?? 0,
    net: existingMap.get(u.id)?.net_salary ?? 0,
    input: rows[u.id] ?? (existingMap.get(u.id)?.base_salary ?? 0),
  }));

  const handleSave = async () => {
    const records = effectiveRows.filter((r) => r.input > 0).map((r) => ({
      user_id: r.user_id, dept_id: deptId || undefined, month, base_salary: r.input,
    }));
    if (records.length === 0) { toast.error("Không có dữ liệu"); return; }
    try { await createBatch.mutateAsync(records); toast.success(`Lưu ${records.length} NV`); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs text-muted-foreground font-medium">Tháng</label>
          <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")}
            className="mt-1 block h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
        </div>
        <div className="w-48">
          <label className="text-xs text-muted-foreground font-medium">Phòng ban</label>
          <SearchSelect value={deptId} onChange={setDeptId}
            options={[{ value: "", label: "— Chọn PB —" }, ...depts.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))]}
            className="mt-1" />
        </div>
        {canManage && deptId && (
          <div className="self-end flex items-center gap-2">
            <button onClick={handleDownloadTemplate} className="h-9 px-3 rounded-lg border border-border hover:bg-secondary text-xs flex items-center gap-1 transition-colors"><Download size={13} /> Tải mẫu</button>
            <button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-border hover:bg-secondary text-xs flex items-center gap-1 transition-colors"><Upload size={13} /> Import</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
            <Button variant="primary" onClick={handleSave} disabled={createBatch.isPending}>{createBatch.isPending ? "Đang lưu..." : "Lưu lương"}</Button>
          </div>
        )}
      </div>
      {!deptId ? (
        <EmptyState icon={<Wallet size={32} strokeWidth={1.5} />} title="Chọn phòng ban" subtitle="Chọn 1 PB để nhập lương hàng loạt" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-muted-foreground">
              {["Nhân viên", "Lương hiện tại", "Đã khấu trừ", "Thực nhận", "Lương mới"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-border/30">
              {effectiveRows.map((r) => (
                <tr key={r.user_id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.full_name}</td>
                  <td className="px-4 py-2.5 font-mono">{formatVND(r.current)}</td>
                  <td className="px-4 py-2.5 font-mono text-red-400">{r.deduction > 0 ? `-${formatVND(r.deduction)}` : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-green-500">{formatVND(r.net)}</td>
                  <td className="px-4 py-2.5">
                    {canManage ? (
                      <input type="number" min={0} value={r.input || ""} onChange={(e) => setRows({ ...rows, [r.user_id]: +e.target.value })}
                        className="w-32 h-7 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none" />
                    ) : <span className="font-mono">{formatVND(r.input)}</span>}
                  </td>
                </tr>
              ))}
              {effectiveRows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Không có NV trong PB</td></tr>}
            </tbody>
          </table>
        </div>
      )}
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
          {["Nhân viên", "Đợt khoán", "Tổng nợ", "Còn lại", "Trừ/tháng", "Trạng thái"].map(h => (
            <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
          ))}
        </tr></thead>
        <tbody className="divide-y divide-border/30">
          {deductions.map((d: any) => (
            <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
              <td className="px-4 py-2.5 font-medium">{d.user?.full_name ?? "—"}</td>
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
