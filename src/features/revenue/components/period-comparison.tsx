"use client";

import { useRevenueByPeriod } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  from: string;
  to: string;
  groupBy: "month" | "quarter" | "year";
}

function shiftDate(date: string, spanMs: number): string {
  return new Date(new Date(date).getTime() - spanMs).toISOString().split("T")[0];
}

export function PeriodComparison({ from, to, groupBy }: Props) {
  const { t } = useI18n();
  const spanMs = new Date(to).getTime() - new Date(from).getTime();
  const prevFrom = shiftDate(from, spanMs);
  const prevTo = shiftDate(to, spanMs);

  const { data: current = [] } = useRevenueByPeriod({ group_by: groupBy, from, to });
  const { data: previous = [] } = useRevenueByPeriod({ group_by: groupBy, from: prevFrom, to: prevTo });

  const prevMap = new Map(previous.map(p => [p.period, p.amount]));

  const chartData = current.map(c => {
    const prev = prevMap.get(c.period) ?? 0;
    const growth = prev > 0 ? Math.round(((c.amount - prev) / prev) * 10000) / 100 : 0;
    return { period: c.period, current: c.amount, previous: prev, growth };
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{t.revenue.byPeriod} — So sánh kỳ trước</p>
        <div className="flex items-center gap-3 text-[10px]">
          {chartData.length > 0 && (() => {
            const totalCurrent = chartData.reduce((s, d) => s + d.current, 0);
            const totalPrev = chartData.reduce((s, d) => s + d.previous, 0);
            const totalGrowth = totalPrev > 0 ? Math.round(((totalCurrent - totalPrev) / totalPrev) * 100) : 0;
            return (
              <span className={totalGrowth >= 0 ? "text-green-600" : "text-red-500"}>
                {totalGrowth >= 0 ? "+" : ""}{totalGrowth}% tổng kỳ
              </span>
            );
          })()}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
          <Tooltip formatter={(v: number) => formatVND(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="previous" name="Kỳ trước" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="current" name="Kỳ hiện tại" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
