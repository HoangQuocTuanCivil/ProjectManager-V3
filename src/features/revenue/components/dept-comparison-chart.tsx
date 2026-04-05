"use client";

import { useRevenueByDepartment } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  from?: string;
  to?: string;
}

export function DeptComparisonChart({ from, to }: Props) {
  const { t } = useI18n();
  const { data = [] } = useRevenueByDepartment({ from, to });

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.deptAllocationTitle}</p>
        <p className="text-xs text-muted-foreground text-center py-10">Chưa có dữ liệu</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.deptAllocationTitle}</p>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
          <YAxis type="category" dataKey="dept_code" tick={{ fontSize: 11 }} width={70} />
          <Tooltip formatter={(v: number) => formatVND(v)} />
          <Bar dataKey="total_allocated" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
