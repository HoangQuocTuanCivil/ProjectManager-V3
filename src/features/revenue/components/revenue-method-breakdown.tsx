"use client";

import { useRevenueSummary } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";

interface Props {
  from?: string;
  to?: string;
}

export function RevenueMethodBreakdown({ from, to }: Props) {
  const { t } = useI18n();
  const { data: summary } = useRevenueSummary({ from, to });

  const methods = summary?.byMethod ?? {};
  const total = Object.values(methods).reduce((s, v) => s + v, 0);

  const rows = [
    { key: "acceptance", label: t.revenue.methodAcceptance, color: "bg-blue-500" },
    { key: "completion_rate", label: t.revenue.methodCompletion, color: "bg-purple-500" },
    { key: "time_based", label: t.revenue.methodTime, color: "bg-amber-500" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.method}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-2 font-medium">Phương pháp</th>
            <th className="text-right py-2 font-medium">{t.revenue.amount}</th>
            <th className="text-right py-2 font-medium w-16">%</th>
            <th className="py-2 w-32" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {rows.map(r => {
            const value = methods[r.key] ?? 0;
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <tr key={r.key}>
                <td className="py-2.5 font-medium">{r.label}</td>
                <td className="py-2.5 text-right font-mono">{formatVND(value)}</td>
                <td className="py-2.5 text-right text-muted-foreground">{pct}%</td>
                <td className="py-2.5 pl-3">
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${r.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="py-2 font-bold">Tổng</td>
            <td className="py-2 text-right font-mono font-bold text-primary">{formatVND(total)}</td>
            <td className="py-2 text-right text-muted-foreground">100%</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
