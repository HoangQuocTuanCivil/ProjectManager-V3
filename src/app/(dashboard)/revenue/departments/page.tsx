"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { DeptComparisonChart } from "@/features/revenue/components/dept-comparison-chart";
import { DeptRevenueTable } from "@/features/revenue/components/dept-revenue-table";

export default function RevenueDepartmentsPage() {
  const { t } = useI18n();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">{t.revenue.deptAllocationTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.revenue.deptAllocationSub}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none"
            placeholder={t.revenue.periodStart} />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none"
            placeholder={t.revenue.periodEnd} />
        </div>
      </div>

      <DeptComparisonChart from={dateFrom || undefined} to={dateTo || undefined} />
      <DeptRevenueTable from={dateFrom || undefined} to={dateTo || undefined} />
    </div>
  );
}
