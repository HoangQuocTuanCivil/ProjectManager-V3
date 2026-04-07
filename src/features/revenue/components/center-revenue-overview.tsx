"use client";

import { useState } from "react";
import { useCenterRevenue, type CenterRevenueItem } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import { ChevronDown, ChevronRight, X } from "lucide-react";

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

function CenterRow({ item, color, onSelect }: { item: CenterRevenueItem; color: string; onSelect: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasPsData = item.by_product_service.length > 0;

  return (
    <>
      <tr
        className="hover:bg-secondary/20 transition-colors cursor-pointer"
        onClick={() => hasPsData ? onSelect() : undefined}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && hasPsData) { e.preventDefault(); onSelect(); } }}
        tabIndex={0}
        role="row"
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {hasPsData && <ChevronRight size={13} className="text-muted-foreground" />}
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="font-mono text-xs text-accent">{item.center_code || "—"}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 font-medium">{item.center_name}</td>
        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(item.total_revenue)}</td>
        <td className="px-4 py-2.5 text-center text-muted-foreground">{item.project_count}</td>
      </tr>
    </>
  );
}

function CenterPsModal({ item, color, onClose }: { item: CenterRevenueItem; color: string; onClose: () => void }) {
  const psTotal = item.by_product_service.reduce((s, ps) => s + ps.amount, 0);
  const pieData = item.by_product_service.map((ps) => ({
    name: ps.ps_name,
    value: ps.amount,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <h3 className="text-sm font-bold">{item.center_name}</h3>
            <span className="text-xs text-muted-foreground">— {formatVND(item.total_revenue)}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors" aria-label="Đóng">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-muted-foreground mb-3">Theo lĩnh vực sản phẩm / dịch vụ</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}
                label={({ percent }: { percent: number }) => `${(percent * 100).toFixed(1)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatVND(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-1.5">
            {item.by_product_service.map((ps, i) => (
              <div key={ps.ps_id} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="flex-1 truncate">{ps.ps_name}</span>
                <span className="font-mono text-muted-foreground">{psTotal > 0 ? ((ps.amount / psTotal) * 100).toFixed(1) : 0}%</span>
                <span className="font-mono font-semibold w-28 text-right">{formatVND(ps.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CenterRevenueOverview({ from, to }: Props) {
  const { t } = useI18n();
  const { data = [], isLoading } = useCenterRevenue({ from, to });
  const [selectedCenter, setSelectedCenter] = useState<CenterRevenueItem | null>(null);

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

  const selectedColor = selectedCenter
    ? COLORS[data.findIndex((d) => d.center_id === selectedCenter.center_id) % COLORS.length]
    : "#3b82f6";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.revenueByCenter}>
          <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.revenueByCenter}</p>
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48 + 40)}>
            <BarChart data={data} layout="vertical" margin={{ left: 10 }}
              onClick={(state) => {
                if (state?.activePayload?.[0]?.payload) {
                  const item = state.activePayload[0].payload as CenterRevenueItem;
                  if (item.by_product_service.length > 0) setSelectedCenter(item);
                }
              }}
              style={{ cursor: "pointer" }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <YAxis type="category" dataKey="center_name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v: number) => [formatVND(v), ""]} />
              <Bar dataKey="total_revenue" radius={[0, 4, 4, 0]} barSize={28}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} cursor="pointer" />)}
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
                label={({ percent }: { percent: number }) => `${(percent * 100).toFixed(1)}%`}
                onClick={(_, idx) => {
                  const item = data[idx];
                  if (item?.by_product_service.length > 0) setSelectedCenter(item);
                }}
                style={{ cursor: "pointer" }}>
                {pieData.map((d, i) => <Cell key={i} fill={d.fill} cursor="pointer" />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatVND(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

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
              <CenterRow key={item.center_id} item={item} color={COLORS[i % COLORS.length]}
                onSelect={() => setSelectedCenter(item)} />
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

      {selectedCenter && (
        <CenterPsModal item={selectedCenter} color={selectedColor} onClose={() => setSelectedCenter(null)} />
      )}
    </div>
  );
}
