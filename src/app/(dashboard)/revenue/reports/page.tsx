"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useRevenueEntries, useRevenueSummary } from "@/lib/hooks/use-revenue";
import { PeriodComparison } from "@/features/revenue/components/period-comparison";
import { RevenueMethodBreakdown } from "@/features/revenue/components/revenue-method-breakdown";
import { RevenueForecastChart } from "@/features/revenue/components/revenue-forecast-chart";
import { exportRevenueExcel, exportRevenuePDF } from "@/features/revenue/utils/export-revenue";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";

function defaultRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    from: `${y}-${String(m + 1).padStart(2, "0")}-01`,
    to: now.toISOString().split("T")[0],
  };
}

export default function RevenueReportsPage() {
  const { t } = useI18n();
  const [range, setRange] = useState(defaultRange);
  const [groupBy, setGroupBy] = useState<"month" | "quarter" | "year">("month");

  const { data: entriesRes } = useRevenueEntries({ date_from: range.from, date_to: range.to, per_page: 500 });
  const { data: summary } = useRevenueSummary({ from: range.from, to: range.to });

  const handleExportExcel = () => {
    exportRevenueExcel({ entries: entriesRes?.data ?? [], summary });
    toast.success(t.revenue.exportExcel);
  };

  return (
    <div className="space-y-5 animate-fade-in print:space-y-3">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-base font-bold">{t.revenue.reports}</h2>
          <p className="text-sm text-muted-foreground">{t.revenue.forecastSub}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={range.from} onChange={(e) => setRange(r => ({ ...r, from: e.target.value }))}
            className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={range.to} onChange={(e) => setRange(r => ({ ...r, to: e.target.value }))}
            className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
          <div className="flex items-center gap-1 ml-2">
            {(["month", "quarter", "year"] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${groupBy === g ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                {g === "month" ? t.revenue.byMonth : g === "quarter" ? t.revenue.byQuarter : t.revenue.byYear}
              </button>
            ))}
          </div>
          <button onClick={handleExportExcel} className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors" title={t.revenue.exportExcel}><Download size={15} /></button>
          <button onClick={exportRevenuePDF} className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors" title={t.revenue.exportPdf}><Printer size={15} /></button>
        </div>
      </div>

      <PeriodComparison from={range.from} to={range.to} groupBy={groupBy} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueMethodBreakdown from={range.from} to={range.to} />
        <RevenueForecastChart />
      </div>
    </div>
  );
}
