"use client";

import { useI18n } from "@/lib/i18n";

interface Props {
  recognized: number;
  contractValue: number;
}

export function ProjectRevenueProgress({ recognized, contractValue }: Props) {
  const { t } = useI18n();
  const pct = contractValue > 0 ? Math.min(100, Math.round((recognized / contractValue) * 100)) : 0;
  const color = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{t.revenue.completionPercentage}</span>
        <span className="text-sm font-bold font-mono">{pct}%</span>
      </div>
      <div className="w-full h-3 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t.revenue.completionPercentage}>
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
        <span>{t.revenue.totalConfirmed}: <span className="font-mono text-foreground">{recognized.toLocaleString("vi-VN")}đ</span></span>
        <span>{t.revenue.totalRevenue}: <span className="font-mono text-foreground">{contractValue.toLocaleString("vi-VN")}đ</span></span>
      </div>
    </div>
  );
}
