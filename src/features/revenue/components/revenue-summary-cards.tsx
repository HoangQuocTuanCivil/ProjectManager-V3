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

  const confirmed = summary?.total ?? 0;
  const projected = forecast?.projected_from_milestones ?? 0;
  const recognizedPct = projected > 0 ? Math.round((confirmed / projected) * 100) : null;

  const cards = [
    { label: t.revenue.totalRevenue, value: confirmed, color: "text-primary" },
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
    {
      label: t.revenue.recognizedVsForecast,
      value: null,
      render: () => (
        <div>
          <p className="text-lg font-bold font-mono text-green-500">{formatVND(confirmed)}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(recognizedPct ?? 0, 100)}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{recognizedPct ?? 0}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t.revenue.forecast}: {formatVND(projected)}</p>
        </div>
      ),
    },
    { label: t.revenue.statusDraft, value: summary?.draft ?? 0, color: "text-yellow-500" },
    { label: t.revenue.forecast, value: projected, color: "text-accent" },
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
