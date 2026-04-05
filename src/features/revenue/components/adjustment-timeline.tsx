"use client";

import { useAdjustmentsByContract } from "../hooks/use-revenue-adjustments";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";

interface Props {
  contractIds: string[];
}

export function AdjustmentTimeline({ contractIds }: Props) {
  const { t } = useI18n();
  const firstId = contractIds[0];
  const { data: res, isLoading } = useAdjustmentsByContract(firstId ?? "");
  const adjustments = res?.data ?? [];

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.adjustmentTitle}</p>
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-6 bg-secondary rounded animate-pulse" />)}</div>
      </div>
    );
  }

  if (adjustments.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.adjustmentTitle}</p>
        <p className="text-xs text-muted-foreground text-center py-6">{t.revenue.noAdjustments}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-medium text-muted-foreground mb-4">{t.revenue.adjustmentTitle}</p>
      <div className="space-y-0" role="list" aria-label={t.revenue.adjustmentTitle}>
        {adjustments.map((adj, i) => {
          const isPositive = adj.adjustment_amount >= 0;
          return (
            <div key={adj.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full mt-1 ${isPositive ? "bg-green-500" : "bg-red-500"}`} />
                {i < adjustments.length - 1 && <div className="w-px flex-1 bg-border min-h-[24px]" />}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{adj.reason}</span>
                  <span className={`text-xs font-mono font-bold ${isPositive ? "text-green-600" : "text-red-500"}`}>
                    {isPositive ? "+" : ""}{formatVND(adj.adjustment_amount)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                  <span>{formatVND(adj.old_amount)} → {formatVND(adj.new_amount)}</span>
                  <span>{new Date(adj.created_at).toLocaleDateString("vi-VN")}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
