"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/stores";
import { useI18n } from "@/lib/i18n";
import { useCreateRevenueEntry, useRevenueEntries, useRevenueSummary } from "@/lib/hooks/use-revenue";
import { useProjects } from "@/lib/hooks/use-projects";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useProductServices } from "@/features/revenue/hooks/use-product-services";
import { Button } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { RevenueSummaryCards } from "@/features/revenue/components/revenue-summary-cards";
import { RevenueCharts } from "@/features/revenue/components/revenue-charts";
import { RevenueTable } from "@/features/revenue/components/revenue-table";
import { RevenueFilters, type RevenueFilterValues } from "@/features/revenue/components/revenue-filters";
import { exportRevenueExcel, exportRevenuePDF } from "@/features/revenue/utils/export-revenue";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import type { RevenueDimension, RecognitionMethod, RevenueSource } from "@/lib/types";

type Tab = "overview" | "table";

export default function CompanyRevenuePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const canManage = !!user && ["admin", "leader", "director"].includes(user.role);

  const [tab, setTab] = useState<Tab>("overview");
  const [filters, setFilters] = useState<RevenueFilterValues>({});
  const [groupBy, setGroupBy] = useState<"month" | "quarter" | "year">("month");
  const [showForm, setShowForm] = useState(false);

  const { data: entriesRes } = useRevenueEntries({ ...filters, per_page: 500 });
  const { data: summary } = useRevenueSummary({ from: filters.date_from, to: filters.date_to, project_id: filters.project_id });

  const handleExportExcel = () => {
    exportRevenueExcel({ entries: entriesRes?.data ?? [], summary });
    toast.success(t.revenue.exportExcel);
  };

  return (
    <div className="space-y-5 animate-fade-in print:space-y-3">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">{t.revenue.companySub}</p>
        <div className="flex items-center gap-2" role="tablist" aria-label={t.revenue.totalRevenue}>
          {(["overview", "table"] as const).map((v) => (
            <button key={v} onClick={() => setTab(v)} role="tab" aria-selected={tab === v}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {v === "overview" ? t.revenue.totalRevenue : t.revenue.reports}
            </button>
          ))}
          <button onClick={handleExportExcel} className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors focus-ring" aria-label={t.revenue.exportExcel} title={t.revenue.exportExcel}><Download size={15} aria-hidden="true" /></button>
          <button onClick={exportRevenuePDF} className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors focus-ring" aria-label={t.revenue.exportPdf} title={t.revenue.exportPdf}><Printer size={15} aria-hidden="true" /></button>
          {canManage && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              {t.revenue.newEntry}
            </Button>
          )}
        </div>
      </div>

      {showForm && canManage && <CreateFormModal onClose={() => setShowForm(false)} />}

      {tab === "overview" && (
        <>
          <RevenueSummaryCards from={filters.date_from} to={filters.date_to} projectId={filters.project_id} />
          <div className="flex items-center gap-2">
            {(["month", "quarter", "year"] as const).map((g) => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${groupBy === g ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                {g === "month" ? t.revenue.byMonth : g === "quarter" ? t.revenue.byQuarter : t.revenue.byYear}
              </button>
            ))}
          </div>
          <RevenueCharts from={filters.date_from} to={filters.date_to} projectId={filters.project_id} groupBy={groupBy} />
        </>
      )}

      <RevenueFilters value={filters} onChange={setFilters} />
      <RevenueTable filters={filters as Record<string, string | undefined>} canManage={canManage} />
    </div>
  );
}

function CreateFormModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const create = useCreateRevenueEntry();
  const { data: projects = [] } = useProjects();
  const { data: contracts = [] } = useContracts();
  const { data: psRes } = useProductServices({ is_active: "true" });
  const productServices = psRes?.data ?? [];

  const [form, setForm] = useState({
    project_id: "" as string | null, contract_id: "" as string | null,
    dimension: "project" as RevenueDimension, method: "acceptance" as RecognitionMethod,
    source: "manual" as RevenueSource, amount: 0, description: "",
    period_start: "", period_end: "", notes: "",
    recognition_date: new Date().toISOString().split("T")[0],
    product_service_id: "" as string | null,
  });

  const handleCreate = async () => {
    if (!form.description || !form.amount) { toast.error("Nhập mô tả và số tiền"); return; }
    try {
      await create.mutateAsync({
        project_id: form.project_id || null,
        contract_id: form.contract_id || null,
        dept_id: null,
        dimension: form.dimension,
        method: form.method,
        source: form.source,
        source_id: null,
        amount: form.amount,
        description: form.description,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        notes: form.notes || null,
        recognition_date: form.recognition_date,
        product_service_id: form.product_service_id || null,
      });
      toast.success(t.revenue.create);
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Tiêu đề */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
          <h3 className="text-base font-bold text-primary">{t.revenue.newEntry}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>

        {/* Nội dung form */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.dimension}</label>
              <SearchSelect value={form.dimension} onChange={(v) => setForm({ ...form, dimension: v as RevenueDimension })}
                options={[
                  { value: "project", label: t.revenue.dimProject },
                  { value: "contract", label: t.revenue.dimContract },
                  { value: "period", label: t.revenue.dimPeriod },
                  { value: "product_service", label: t.revenue.dimProductService },
                ]} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.method}</label>
              <SearchSelect value={form.method} onChange={(v) => setForm({ ...form, method: v as RecognitionMethod })}
                options={[
                  { value: "acceptance", label: t.revenue.methodAcceptance },
                  { value: "completion_rate", label: t.revenue.methodCompletion },
                  { value: "time_based", label: t.revenue.methodTime },
                ]} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.selectProject}</label>
              <SearchSelect value={form.project_id || ""} onChange={(v) => setForm({ ...form, project_id: v || null })}
                options={[{ value: "", label: "—" }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
                className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.selectContract}</label>
              <SearchSelect value={form.contract_id || ""} onChange={(v) => setForm({ ...form, contract_id: v || null })}
                options={[{ value: "", label: "—" }, ...contracts.map((c: any) => ({ value: c.id, label: c.contract_no }))]}
                className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.productService}</label>
              <SearchSelect value={form.product_service_id || ""} onChange={(v) => setForm({ ...form, product_service_id: v || null })}
                options={[{ value: "", label: "—" }, ...productServices.map((ps) => ({ value: ps.id, label: `${ps.code} — ${ps.name}` }))]}
                className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.recognitionDate} *</label>
              <input type="date" value={form.recognition_date} onChange={(e) => setForm({ ...form, recognition_date: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.amount} *</label>
              <input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.periodStart}</label>
              <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
            </div>
            <div className="col-span-3">
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.description} *</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t.revenue.notes}</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-card rounded-b-2xl">
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={handleCreate} disabled={create.isPending}>
            {create.isPending ? t.revenue.creating : t.revenue.create}
          </Button>
        </div>
      </div>
    </div>
  );
}
