"use client";

import { useState } from "react";
import { useCenterRevenue, type CenterRevenueItem } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

function shortVND(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, "")}T`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}Tr`;
  return `${(v / 1e3).toFixed(0)}K`;
}

interface Props {
  from?: string;
  to?: string;
}

function CenterRow({ item, color }: { item: CenterRevenueItem; color: string }) {
  const [expanded, setExpanded] = useState(false);
  const hasPsData = item.by_product_service.length > 0;

  return (
    <>
      <tr
        className="hover:bg-secondary/20 transition-colors cursor-pointer"
        onClick={() => hasPsData && setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        tabIndex={0}
        role="row"
        aria-expanded={expanded}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {hasPsData && (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="font-mono text-xs text-accent">{item.center_code || "—"}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 font-medium">{item.center_name}</td>
        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(item.total_revenue)}</td>
        <td className="px-4 py-2.5 text-center text-muted-foreground">{item.project_count}</td>
      </tr>
      {expanded && item.by_product_service.map((ps) => (
        <tr key={ps.ps_id} className="bg-secondary/5">
          <td className="px-4 py-1.5 pl-10" />
          <td className="px-4 py-1.5 text-xs text-muted-foreground">
            {ps.ps_code ? `${ps.ps_code} — ` : ""}{ps.ps_name}
          </td>
          <td className="px-4 py-1.5 text-right text-xs font-mono">{formatVND(ps.amount)}</td>
          <td />
        </tr>
      ))}
    </>
  );
}

function CenterPsChart({ item, color }: { item: CenterRevenueItem; color: string }) {
  if (item.by_product_service.length === 0) return null;

  const pieData = item.by_product_service.map((ps, i) => ({
    name: ps.ps_name,
    value: ps.amount,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <p className="text-xs font-medium">{item.center_name}</p>
        <span className="text-xs text-muted-foreground ml-auto">{formatVND(item.total_revenue)}</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2}
            label={({ percent }: { percent: number }) => `${(percent * 100).toFixed(1)}%`}>
            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => formatVND(v)} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CenterRevenueOverview({ from, to }: Props) {
  const { t } = useI18n();
  const { data = [], isLoading } = useCenterRevenue({ from, to });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map(i => <div key={i} className="bg-card border border-border rounded-xl p-4 h-[280px] animate-pulse" />)}
        </div>
        {[0, 1, 2].map(i => <div key={i} className="h-8 bg-secondary rounded animate-pulse" />)}
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-10">{t.revenue.noEntries}</p>;
  }

  const total = data.reduce((s, c) => s + c.total_revenue, 0);

  const pieData = data.map((c, i) => ({
    name: c.center_name,
    value: c.total_revenue,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-4">
      {/* Biểu đồ tổng thể */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.revenueByCenter}>
          <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.revenueByCenter}</p>
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48 + 40)}>
            <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <YAxis type="category" dataKey="center_name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v: number) => [formatVND(v), ""]} />
              <Bar dataKey="total_revenue" radius={[0, 4, 4, 0]} barSize={28}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                <LabelList dataKey="total_revenue" position="right" fontSize={10} formatter={(v: number) => shortVND(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.revenueShareByCenter}>
          <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.revenueShareByCenter}</p>
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48 + 40)}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}
                label={({ value, percent }: { value: number; percent: number }) => `${(percent * 100).toFixed(1)}%`}>
                {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatVND(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SP/DV từng trung tâm riêng */}
      <p className="text-xs font-medium text-muted-foreground">{t.revenue.byProductService} — {t.revenue.revenueByCenter}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((item, i) => (
          <CenterPsChart key={item.center_id} item={item} color={COLORS[i % COLORS.length]} />
        ))}
      </div>

      {/* Bảng chi tiết */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-medium w-28">Mã TT</th>
              <th className="text-left px-4 py-2.5 font-medium">Trung tâm</th>
              <th className="text-right px-4 py-2.5 font-medium">Doanh thu</th>
              <th className="text-center px-4 py-2.5 font-medium w-20">Số DA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {data.map((item, i) => (
              <CenterRow key={item.center_id} item={item} color={COLORS[i % COLORS.length]} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-secondary/20">
              <td colSpan={2} className="px-4 py-2 font-bold">{t.revenue.totalRevenue}</td>
              <td className="px-4 py-2 text-right font-mono font-bold text-primary">{formatVND(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
