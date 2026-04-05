"use client";

import { useRevenueForecast, useRevenueByPeriod } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  projectId?: string;
  months?: number;
}

export function RevenueForecastChart({ projectId, months = 6 }: Props) {
  const { t } = useI18n();
  const { data: forecast } = useRevenueForecast({ project_id: projectId, months: String(months) });

  const now = new Date();
  const fromDate = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}-01`;
  const { data: actuals = [] } = useRevenueByPeriod({
    group_by: "month",
    from: fromDate,
    project_id: projectId,
  });

  const actualMap = new Map(actuals.map(a => [a.period, a.amount]));

  const chartData = (forecast?.periods ?? []).map(p => ({
    period: p.period,
    actual: actualMap.get(p.period) ?? 0,
    forecast: p.projected_amount,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{t.revenue.forecastTitle}</p>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>{t.revenue.totalConfirmed}: <span className="font-mono text-foreground">{formatVND(forecast?.total_confirmed ?? 0)}</span></span>
          <span>{t.revenue.projectedFromMilestones}: <span className="font-mono text-foreground">{formatVND(forecast?.projected_from_milestones ?? 0)}</span></span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
          <Tooltip formatter={(v: number) => formatVND(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="actual" name="Thực tế" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="forecast" name="Dự báo" fill="#3b82f6" fillOpacity={0.25} stroke="#3b82f6" strokeDasharray="4 2" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
