"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useRevenueEntries, useCreateRevenueEntry, useDeleteRevenueEntry } from "@/lib/hooks/use-revenue";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { useI18n } from "@/lib/i18n";
import { formatVND, formatDate } from "@/lib/utils/format";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { RevenueDimension, RecognitionMethod, RevenueSource } from "@/lib/types";

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

const DIMENSION_COLORS: Record<string, string> = {
  project: "#3b82f6", contract: "#8b5cf6", period: "#f59e0b", product_service: "#10b981",
};

export default function CompanyRevenuePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();
  const { data: contracts = [] } = useContracts();
  const { data: departments = [] } = useDepartments();
  const canManage = user && ["admin", "leader", "director"].includes(user.role);

  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterDimension, setFilterDimension] = useState<string>("");
  const { data: entries = [] } = useRevenueEntries({
    projectId: filterProjectId || undefined,
    dimension: filterDimension || undefined,
  });
  const create = useCreateRevenueEntry();
  const remove = useDeleteRevenueEntry();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    project_id: "" as string | null, contract_id: "" as string | null, dept_id: "" as string | null,
    dimension: "project" as RevenueDimension, method: "acceptance" as RecognitionMethod,
    source: "manual" as RevenueSource, amount: 0, description: "", period_start: "", period_end: "", notes: "",
  });

  const totalRevenue = useMemo(() => entries.reduce((s, e) => s + Number(e.amount), 0), [entries]);

  // Group by dimension for summary
  const dimSummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) { map[e.dimension] = (map[e.dimension] || 0) + Number(e.amount); }
    return map;
  }, [entries]);

  const handleCreate = async () => {
    if (!form.description || !form.amount) { toast.error("Nhập mô tả và số tiền"); return; }
    try {
      await create.mutateAsync({
        project_id: form.project_id || null,
        contract_id: form.contract_id || null,
        dept_id: form.dept_id || null,
        dimension: form.dimension,
        method: form.method,
        source: form.source,
        source_id: null,
        amount: form.amount,
        description: form.description,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        notes: form.notes || null,
      });
      toast.success("Ghi nhận doanh thu thành công!");
      setShowForm(false);
      setForm({ project_id: "", contract_id: "", dept_id: "", dimension: "project", method: "acceptance", source: "manual", amount: 0, description: "", period_start: "", period_end: "", notes: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  const dimLabel = (d: string) => (t.revenue as any)[`dim${d.charAt(0).toUpperCase() + d.slice(1).replace(/_./g, (m) => m[1].toUpperCase())}`] || d;
  const methodLabel = (m: string) => (t.revenue as any)[`method${m.charAt(0).toUpperCase() + m.slice(1).replace(/_./g, (x) => x[1].toUpperCase())}`] || m;
  const sourceLabel = (s: string) => (t.revenue as any)[`source${s.charAt(0).toUpperCase() + s.slice(1).replace(/_./g, (x) => x[1].toUpperCase())}`] || s;

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">{t.revenue.companySub}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">{t.revenue.totalRevenue}</p>
          <p className="text-lg font-bold font-mono text-primary">{formatVND(totalRevenue)}</p>
        </div>
        {(["project", "contract", "period", "product_service"] as const).map((dim) => (
          <div key={dim} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">{dimLabel(dim)}</p>
            <p className="text-sm font-bold font-mono" style={{ color: DIMENSION_COLORS[dim] }}>{formatVND(dimSummary[dim] || 0)}</p>
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
          <SearchSelect value={filterDimension} onChange={setFilterDimension}
            options={[
              { value: "", label: t.revenue.allDimensions },
              { value: "project", label: t.revenue.dimProject },
              { value: "contract", label: t.revenue.dimContract },
              { value: "period", label: t.revenue.dimPeriod },
              { value: "product_service", label: t.revenue.dimProductService },
            ]} />
        </div>
        <div className="flex-1" />
        {canManage && (
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t.common.cancel : t.revenue.newEntry}
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && canManage && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4 animate-slide-in-bottom">
          <h3 className="text-base font-bold text-primary">{t.revenue.newEntry}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.dimension}</label>
              <SearchSelect value={form.dimension} onChange={(v) => setForm({ ...form, dimension: v as RevenueDimension })}
                options={[
                  { value: "project", label: t.revenue.dimProject },
                  { value: "contract", label: t.revenue.dimContract },
                  { value: "period", label: t.revenue.dimPeriod },
                  { value: "product_service", label: t.revenue.dimProductService },
                ]} className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.method}</label>
              <SearchSelect value={form.method} onChange={(v) => setForm({ ...form, method: v as RecognitionMethod })}
                options={[
                  { value: "acceptance", label: t.revenue.methodAcceptance },
                  { value: "completion_rate", label: t.revenue.methodCompletion },
                  { value: "time_based", label: t.revenue.methodTime },
                ]} className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.source}</label>
              <SearchSelect value={form.source} onChange={(v) => setForm({ ...form, source: v as RevenueSource })}
                options={[
                  { value: "manual", label: t.revenue.sourceManual },
                  { value: "billing_milestone", label: t.revenue.sourceBilling },
                  { value: "acceptance", label: t.revenue.sourceAcceptance },
                ]} className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.selectProject}</label>
              <SearchSelect value={form.project_id || ""} onChange={(v) => setForm({ ...form, project_id: v || null })}
                options={[{ value: "", label: "—" }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
                className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.selectContract}</label>
              <SearchSelect value={form.contract_id || ""} onChange={(v) => setForm({ ...form, contract_id: v || null })}
                options={[{ value: "", label: "—" }, ...contracts.map((c: any) => ({ value: c.id, label: `${c.contract_no} — ${c.title}` }))]}
                className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.selectDept}</label>
              <SearchSelect value={form.dept_id || ""} onChange={(v) => setForm({ ...form, dept_id: v || null })}
                options={[{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))]}
                className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.amount} *</label>
              <input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.periodStart}</label>
              <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.periodEnd}</label>
              <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.description} *</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
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

      {/* Revenue table */}
      {entries.length === 0 ? (
        <EmptyState icon="💰" title={t.revenue.noEntries} subtitle={t.revenue.noEntriesSub} />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.description}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.dimension}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.method}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.selectProject}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.selectDept}</th>
                <th className="text-right px-4 py-2.5 font-medium">{t.revenue.amount}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.periodStart}</th>
                {canManage && <th className="text-right px-4 py-2.5 font-medium w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {entries.map((e) => {
                const color = DIMENSION_COLORS[e.dimension] || "#94a3b8";
                return (
                  <tr key={e.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{e.description}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${color}20`, color }}>{dimLabel(e.dimension)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{methodLabel(e.method)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.project?.code || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.department?.code || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(Number(e.amount))}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(e.period_start)}</td>
                    {canManage && (
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => { if (confirm(t.revenue.confirmDelete)) remove.mutate(e.id); }} className="text-destructive hover:underline text-[10px]">{t.common.delete}</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/20">
                <td colSpan={5} className="px-4 py-2 font-bold">{t.revenue.totalRevenue}</td>
                <td className="px-4 py-2 text-right font-mono font-bold text-primary">{formatVND(totalRevenue)}</td>
                <td colSpan={canManage ? 2 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
