"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CenterRevenueOverview } from "@/features/revenue/components/center-revenue-overview";
import { currentMonthRange } from "@/lib/utils/format";

export default function RevenueAllocationPage() {
  const { t } = useI18n();
  const { start: monthStart, end: monthEnd } = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);

  const from = dateFrom || undefined;
  const to = dateTo || undefined;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">{t.revenue.centerRevenueTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.revenue.centerRevenueSub}</p>
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

      <CenterRevenueOverview from={from} to={to} />
    </div>
  );
}
