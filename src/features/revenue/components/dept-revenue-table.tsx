"use client";

import { useState } from "react";
import { useRevenueByDepartment } from "../hooks/use-revenue-analytics";
import { useDeptRevenueByProject } from "../hooks/use-dept-revenue";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  from?: string;
  to?: string;
}

function DeptRow({ dept }: { dept: { dept_id: string; dept_name: string; dept_code: string; total_allocated: number; project_count: number } }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => setExpanded(!expanded)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }} tabIndex={0} role="row" aria-expanded={expanded}>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span className="font-mono text-xs text-primary">{dept.dept_code}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 font-medium">{dept.dept_name}</td>
        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(dept.total_allocated)}</td>
        <td className="px-4 py-2.5 text-center text-muted-foreground">{dept.project_count}</td>
      </tr>
      {expanded && <DeptExpand deptId={dept.dept_id} />}
    </>
  );
}

function DeptExpand({ deptId }: { deptId: string }) {
  const { data: allocations = [] } = useDeptRevenueByProject("");

  const deptAllocations = allocations.filter(a => a.dept_id === deptId);

  if (deptAllocations.length === 0) {
    return (
      <tr><td colSpan={4} className="px-12 py-2 text-xs text-muted-foreground">Không có dữ liệu chi tiết</td></tr>
    );
  }

  return (
    <>
      {deptAllocations.map((a) => (
        <tr key={a.id} className="bg-secondary/5">
          <td className="px-4 py-1.5 pl-10" />
          <td className="px-4 py-1.5 text-xs text-muted-foreground">
            {(a as any).revenue_entry?.description ?? "—"}
          </td>
          <td className="px-4 py-1.5 text-right text-xs font-mono">{formatVND(a.allocated_amount)}</td>
          <td className="px-4 py-1.5 text-center text-xs text-muted-foreground">{a.allocation_percentage}%</td>
        </tr>
      ))}
    </>
  );
}

export function DeptRevenueTable({ from, to }: Props) {
  const { t } = useI18n();
  const { data = [] } = useRevenueByDepartment({ from, to });

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-10">Chưa có dữ liệu phân bổ</p>;
  }

  const total = data.reduce((s, d) => s + d.total_allocated, 0);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left px-4 py-2.5 font-medium w-24">Mã PB</th>
            <th className="text-left px-4 py-2.5 font-medium">Phòng ban</th>
            <th className="text-right px-4 py-2.5 font-medium">{t.revenue.allocatedAmount}</th>
            <th className="text-center px-4 py-2.5 font-medium">{t.revenue.projectCount}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {data.map((dept) => <DeptRow key={dept.dept_id} dept={dept} />)}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-secondary/20">
            <td colSpan={2} className="px-4 py-2 font-bold">Tổng</td>
            <td className="px-4 py-2 text-right font-mono font-bold text-primary">{formatVND(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
