"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CenterComparisonChart } from "@/features/revenue/components/center-comparison-chart";
import { CenterRevenueTable } from "@/features/revenue/components/center-revenue-table";

export default function RevenueCentersPage() {
  const { t } = useI18n();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">{t.revenue.centerAllocationTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.revenue.centerAllocationSub}</p>
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

      <CenterComparisonChart from={dateFrom || undefined} to={dateTo || undefined} />
      <CenterRevenueTable from={dateFrom || undefined} to={dateTo || undefined} />
    </div>
  );
}
