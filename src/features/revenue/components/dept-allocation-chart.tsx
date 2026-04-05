"use client";

import { useDeptRevenueByProject } from "../hooks/use-dept-revenue";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#06b6d4"];

interface Props {
  projectId: string;
}

export function DeptAllocationChart({ projectId }: Props) {
  const { t } = useI18n();
  const { data: allocations = [] } = useDeptRevenueByProject(projectId);

  const chartData = allocations.map((a) => ({
    name: (a as any).department?.name ?? a.dept_id.slice(0, 8),
    value: Number(a.allocated_amount),
    pct: a.allocation_percentage,
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.deptAllocation}</p>
        <p className="text-xs text-muted-foreground text-center py-8">Chưa có phân bổ</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3">{t.revenue.deptAllocation}</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => formatVND(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
