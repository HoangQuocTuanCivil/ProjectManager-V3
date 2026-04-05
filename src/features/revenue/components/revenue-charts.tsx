"use client";

import { useRevenueByPeriod, useRevenueSummary } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444"];

interface Props {
  from?: string;
  to?: string;
  projectId?: string;
  groupBy?: "month" | "quarter" | "year";
}

export function RevenueCharts({ from, to, projectId, groupBy = "month" }: Props) {
  const { t } = useI18n();
  const { data: periodData = [], isLoading: loadingPeriod } = useRevenueByPeriod({ group_by: groupBy, from, to, project_id: projectId });
  const { data: summary, isLoading: loadingSummary } = useRevenueSummary({ from, to, project_id: projectId });
  const isLoading = loadingPeriod || loadingSummary;

  const sourceData = summary?.bySource
    ? Object.entries(summary.bySource).map(([name, value]) => ({ name, value }))
    : [];

  const trendData = periodData.length >= 2
    ? periodData.map((d, i) => ({
        ...d,
        growth: i === 0 ? 0 : Math.round(((d.amount - periodData[i - 1].amount) / Math.max(periodData[i - 1].amount, 1)) * 100),
      }))
    : periodData.map(d => ({ ...d, growth: 0 }));

  const sourceLabel = (s: string) => {
    const map: Record<string, string> = {
      billing_milestone: t.revenue.sourceBilling,
      acceptance: t.revenue.sourceAcceptance,
      manual: t.revenue.sourceManual,
    };
    return map[s] || s;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <div key={i} className="bg-card border border-border rounded-xl p-4 h-[280px] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.byPeriod}>
        <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.byPeriod}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={periodData}>
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip formatter={(v: number) => formatVND(v)} />
            <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.source}>
        <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.source}</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatVND(v)} />
            <Legend formatter={(v: string) => sourceLabel(v)} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.growthRate}>
        <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.growthRate}</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData}>
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} unit="%" />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Line type="monotone" dataKey="growth" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
