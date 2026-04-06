"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useRevenueEntries, useRevenueSummary } from "@/lib/hooks/use-revenue";
import { PeriodComparison } from "@/features/revenue/components/period-comparison";
import { RevenueMethodBreakdown } from "@/features/revenue/components/revenue-method-breakdown";
import { RevenueForecastChart } from "@/features/revenue/components/revenue-forecast-chart";
import { exportRevenueExcel, exportRevenuePDF } from "@/features/revenue/utils/export-revenue";
import { formatVND } from "@/lib/utils/format";
import { toast } from "sonner";
import { Download, Printer, TrendingUp, TrendingDown } from "lucide-react";

function defaultRange() {
  const now = new Date();
  const y = now.getFullYear();
  return { from: `${y}-01-01`, to: now.toISOString().split("T")[0] };
}

function useProfitLoss(projectId?: string) {
  return useQuery({
    queryKey: ["reports", "profitloss", projectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.set("project_id", projectId);
      const res = await fetch(`/api/reports/profitloss?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ contracts: any[]; totals: any }>;
    },
  });
}

type Tab = "charts" | "profitloss";

export default function RevenueReportsPage() {
  const { t } = useI18n();
  const [range, setRange] = useState(defaultRange);
  const [groupBy, setGroupBy] = useState<"month" | "quarter" | "year">("month");
  const [tab, setTab] = useState<Tab>("charts");

  const { data: entriesRes } = useRevenueEntries({ date_from: range.from, date_to: range.to, per_page: 500 });
  const { data: summary } = useRevenueSummary({ from: range.from, to: range.to });
  const { data: plData } = useProfitLoss();

  return (
    <div className="space-y-5 animate-fade-in print:space-y-3">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-1" role="tablist">
          {([
            { key: "charts" as const, label: "Biểu đồ" },
            { key: "profitloss" as const, label: "Lãi lỗ HĐ" },
          ]).map(v => (
            <button key={v.key} onClick={() => setTab(v.key)} role="tab" aria-selected={tab === v.key}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${tab === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={range.from} onChange={(e) => setRange(r => ({ ...r, from: e.target.value }))}
            className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={range.to} onChange={(e) => setRange(r => ({ ...r, to: e.target.value }))}
            className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
          {tab === "charts" && (
            <div className="flex items-center gap-1 ml-2">
              {(["month", "quarter", "year"] as const).map(g => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${groupBy === g ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                  {g === "month" ? t.revenue.byMonth : g === "quarter" ? t.revenue.byQuarter : t.revenue.byYear}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => { exportRevenueExcel({ entries: entriesRes?.data ?? [], summary }); toast.success(t.revenue.exportExcel); }}
            className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors" title={t.revenue.exportExcel}><Download size={15} /></button>
          <button onClick={exportRevenuePDF} className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors" title={t.revenue.exportPdf}><Printer size={15} /></button>
        </div>
      </div>

      {tab === "charts" && (
        <>
          <PeriodComparison from={range.from} to={range.to} groupBy={groupBy} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenueMethodBreakdown from={range.from} to={range.to} />
            <RevenueForecastChart />
          </div>
        </>
      )}

      {tab === "profitloss" && plData && (
        <div className="space-y-4">
          {/* P&L totals */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Tổng giá trị HĐ", value: plData.totals.contract_value, color: "text-primary" },
              { label: "DT đã ghi nhận", value: plData.totals.total_revenue, color: "text-green-500" },
              { label: "Tổng chi phí", value: plData.totals.total_costs, color: "text-red-400" },
              { label: "Lãi/Lỗ", value: plData.totals.profit, color: plData.totals.profit >= 0 ? "text-green-500" : "text-red-500" },
            ].map((c, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-lg font-bold font-mono ${c.color}`}>{formatVND(c.value)}</p>
              </div>
            ))}
          </div>

          {/* P&L per contract */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  {["Hợp đồng", "Dự án", "Giá trị HĐ", "DT ghi nhận", "% DT", "Chi phí", "Lãi/Lỗ", "Margin"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {plData.contracts.map((c: any) => (
                  <tr key={c.contract_id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{c.contract_no}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.project_code}</td>
                    <td className="px-4 py-2.5 font-mono">{formatVND(c.contract_value)}</td>
                    <td className="px-4 py-2.5 font-mono text-green-500">{formatVND(c.total_revenue)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(c.revenue_pct, 100)}%` }} />
                        </div>
                        <span className="text-muted-foreground font-mono">{c.revenue_pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-red-400">{formatVND(c.total_costs)}</td>
                    <td className={`px-4 py-2.5 font-mono font-bold ${Number(c.profit) >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {Number(c.profit) >= 0 ? "+" : ""}{formatVND(c.profit)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${Number(c.margin_pct) >= 20 ? "bg-green-500/10 text-green-600" : Number(c.margin_pct) >= 0 ? "bg-yellow-500/10 text-yellow-600" : "bg-red-500/10 text-red-500"}`}>
                        {c.margin_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
