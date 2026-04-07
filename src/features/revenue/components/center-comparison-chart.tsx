"use client";

import { useRevenueByCenter } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  from?: string;
  to?: string;
}

export function CenterComparisonChart({ from, to }: Props) {
  const { t } = useI18n();
  const { data = [], isLoading } = useRevenueByCenter({ from, to });

  if (isLoading) {
    return <div className="bg-card border border-border rounded-xl p-4 h-[300px] animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.centerAllocationTitle}</p>
        <p className="text-xs text-muted-foreground text-center py-10">{t.revenue.noEntries}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.centerAllocationTitle}>
      <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.centerAllocationTitle}</p>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
          <YAxis type="category" dataKey="center_name" tick={{ fontSize: 11 }} width={90} />
          <Tooltip formatter={(v: number) => [formatVND(v), ""]} />
          <Bar dataKey="total_allocated" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
