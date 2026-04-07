"use client";

import { useMemo } from "react";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#06b6d4"];
const SCOPE_COLORS: Record<string, string> = { internal: "#3b82f6", external: "#f59e0b" };
const SCOPE_LABELS: Record<string, string> = { internal: "Trong hệ thống", external: "Ngoài hệ thống" };

interface Props {
  from?: string;
  to?: string;
  projectId?: string;
  groupBy?: "month" | "quarter" | "year";
}

export function RevenueCharts({ from, to, projectId, groupBy = "month" }: Props) {
  const { t } = useI18n();
  const { data: allContracts = [], isLoading } = useContracts();

  // HĐ đầu ra active/completed — nguồn dữ liệu chính cho biểu đồ
  const contracts = useMemo(() =>
    (allContracts as any[]).filter((c) =>
      c.contract_type === "outgoing" && ["active", "completed"].includes(c.status)
      && (!projectId || c.project_id === projectId)
    ), [allContracts, projectId]);

  // Giá trị HĐ bao gồm phụ lục
  const ctValue = (c: any) => {
    const base = Number(c.contract_value);
    const addendum = (c.addendums ?? []).reduce((s: number, a: any) => s + Number(a.value_change || 0), 0);
    return base + addendum;
  };

  // Doanh thu theo kỳ — nhóm theo tháng/quý/năm ký HĐ
  const periodData = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contracts) {
      const date = c.signed_date || c.start_date || c.created_at?.slice(0, 10);
      if (!date) continue;
      let key: string;
      if (groupBy === "year") key = date.slice(0, 4);
      else if (groupBy === "quarter") {
        const m = parseInt(date.slice(5, 7));
        key = `${date.slice(0, 4)}-Q${Math.ceil(m / 3)}`;
      } else key = date.slice(0, 7);
      map.set(key, (map.get(key) || 0) + ctValue(c));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([period, amount]) => ({ period, amount }));
  }, [contracts, groupBy]);

  // Theo loại hình (Trong/Ngoài hệ thống)
  const scopeData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of contracts) {
      const scope = c.contract_scope || "internal";
      map[scope] = (map[scope] || 0) + ctValue(c);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [contracts]);

  // Theo hợp đồng
  const contractData = useMemo(() =>
    contracts.map((c) => ({ contract_no: c.contract_no, total: ctValue(c) }))
      .sort((a, b) => b.total - a.total).slice(0, 8),
    [contracts]);

  // Theo lĩnh vực sản phẩm — từ product_service gắn với HĐ
  const psData = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contracts) {
      const name = (c as any).product_service?.name || "Chưa phân loại";
      map.set(name, (map.get(name) || 0) + ctValue(c));
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [contracts]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="bg-card border border-border rounded-xl p-4 h-[280px] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Doanh thu theo kỳ */}
      <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.byPeriod}>
        <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.byPeriod}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={periodData}>
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip formatter={(v: number) => [formatVND(v), ""]} />
            <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Theo loại hình (Trong/Ngoài hệ thống) */}
      <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label="Theo loại hình">
        <p className="text-xs font-medium text-muted-foreground mb-3">Theo loại hình</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={scopeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {scopeData.map((d, i) => <Cell key={i} fill={SCOPE_COLORS[d.name] || COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatVND(v)} />
            <Legend formatter={(v: string) => SCOPE_LABELS[v] || v} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Theo hợp đồng */}
      {contractData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.byContract}>
          <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.byContract}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={contractData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <YAxis type="category" dataKey="contract_no" tick={{ fontSize: 9 }} width={80} />
              <Tooltip formatter={(v: number) => [formatVND(v), ""]} />
              <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Theo lĩnh vực sản phẩm — hiển thị % */}
      {psData.length > 0 && (() => {
        const psTotal = psData.reduce((s, d) => s + d.total, 0);
        return (
          <div className="bg-card border border-border rounded-xl p-4" role="img" aria-label={t.revenue.byProductService}>
            <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.byProductService}</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={psData} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {psData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${psTotal > 0 ? ((v / psTotal) * 100).toFixed(1) : 0}%`, ""]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      })()}
    </div>
  );
}
