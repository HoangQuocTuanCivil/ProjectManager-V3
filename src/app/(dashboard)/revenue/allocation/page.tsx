"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { DeptComparisonChart } from "@/features/revenue/components/dept-comparison-chart";
import { DeptRevenueTable } from "@/features/revenue/components/dept-revenue-table";
import { CenterComparisonChart } from "@/features/revenue/components/center-comparison-chart";
import { CenterRevenueTable } from "@/features/revenue/components/center-revenue-table";

type ViewMode = "center" | "department";

export default function RevenueAllocationPage() {
  const { t } = useI18n();
  const [view, setView] = useState<ViewMode>("center");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const from = dateFrom || undefined;
  const to = dateTo || undefined;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">
            {view === "center" ? t.revenue.centerAllocationTitle : t.revenue.deptAllocationTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {view === "center" ? t.revenue.centerAllocationSub : t.revenue.deptAllocationSub}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none"
            aria-label={t.revenue.periodStart} />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none"
            aria-label={t.revenue.periodEnd} />
        </div>
      </div>

      <div className="flex items-center gap-1" role="tablist" aria-label={t.revenue.deptAllocation}>
        {(["center", "department"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} role="tab" aria-selected={view === v}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            }`}>
            {v === "center" ? t.revenue.centerAllocationTitle : t.revenue.deptAllocationTitle}
          </button>
        ))}
      </div>

      {view === "center" ? (
        <>
          <CenterComparisonChart from={from} to={to} />
          <CenterRevenueTable from={from} to={to} />
        </>
      ) : (
        <>
          <DeptComparisonChart from={from} to={to} />
          <DeptRevenueTable from={from} to={to} />
        </>
      )}
    </div>
  );
}
