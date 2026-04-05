"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useCostEntries, useCreateCostEntry, useDeleteCostEntry } from "@/lib/hooks/use-revenue";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { BarChart3 } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { useI18n } from "@/lib/i18n";
import { formatVND, formatDate } from "@/lib/utils/format";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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

const CATEGORY_COLORS: Record<string, string> = {
  personnel: "#3b82f6", survey: "#f59e0b", procurement: "#8b5cf6", overhead: "#94a3b8",
};

export default function CostsPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();
  const { data: contracts = [] } = useContracts();
  const { data: departments = [] } = useDepartments();
  const canManage = user && ["admin", "leader", "director"].includes(user.role);

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
    category: "overhead" as CostCategory, description: "", amount: 0, budget_amount: 0,
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
      setForm({ project_id: "", contract_id: "", dept_id: "", category: "overhead", description: "", amount: 0, budget_amount: 0, period_start: "", period_end: "", notes: "" });
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
        {(["personnel", "survey"] as const).map((cat) => (
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
              { value: "personnel", label: t.revenue.catPersonnel },
              { value: "survey", label: t.revenue.catSurvey },
              { value: "procurement", label: t.revenue.catProcurement },
              { value: "overhead", label: t.revenue.catOverhead },
            ]} />
        </div>
        <div className="flex-1" />
        {canManage && (
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t.common.cancel : t.revenue.newCost}
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && canManage && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4 animate-slide-in-bottom">
          <h3 className="text-base font-bold text-primary">{t.revenue.newCost}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.category}</label>
              <SearchSelect value={form.category} onChange={(v) => setForm({ ...form, category: v as CostCategory })}
                options={[
                  { value: "personnel", label: t.revenue.catPersonnel },
                  { value: "survey", label: t.revenue.catSurvey },
                  { value: "procurement", label: t.revenue.catProcurement },
                  { value: "overhead", label: t.revenue.catOverhead },
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
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? t.revenue.creating : t.revenue.create}
            </Button>
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
