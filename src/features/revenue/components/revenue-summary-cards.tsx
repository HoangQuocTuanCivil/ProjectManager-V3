"use client";

import { useRevenueSummary, useRevenueForecast } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  from?: string;
  to?: string;
  projectId?: string;
}

export function RevenueSummaryCards({ from, to, projectId }: Props) {
  const { t } = useI18n();
  const { data: summary, isLoading } = useRevenueSummary({ from, to, project_id: projectId });
  const { data: forecast } = useRevenueForecast({ project_id: projectId });

  const cards = [
    { label: t.revenue.totalRevenue, value: summary?.total ?? 0, color: "text-primary" },
    {
      label: t.revenue.growthRate,
      value: summary?.growthRate,
      render: (v: number | null | undefined) => {
        if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
        const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
        const color = v > 0 ? "text-green-500" : v < 0 ? "text-destructive" : "text-muted-foreground";
        return <span className={`flex items-center gap-1 ${color}`} aria-label={`${v > 0 ? "+" : ""}${v}%`}><Icon size={14} aria-hidden="true" />{v > 0 ? "+" : ""}{v}%</span>;
      },
    },
    { label: t.revenue.totalConfirmed, value: summary?.total ?? 0, color: "text-green-500" },
    { label: t.revenue.statusDraft, value: summary?.draft ?? 0, color: "text-yellow-500" },
    { label: t.revenue.forecast, value: forecast?.projected_from_milestones ?? 0, color: "text-accent" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="list" aria-label={t.revenue.totalRevenue}>
      {cards.map((c, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-3" role="listitem">
          <p className="text-[11px] text-muted-foreground mb-1">{c.label}</p>
          {isLoading ? (
            <div className="h-7 w-24 bg-secondary rounded animate-pulse" />
          ) : "render" in c && c.render ? (
            <div className="text-lg font-bold font-mono">{c.render(c.value as number | null)}</div>
          ) : (
            <p className={`text-lg font-bold font-mono ${c.color}`}>{formatVND(c.value as number)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
