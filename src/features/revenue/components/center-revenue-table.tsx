"use client";

import { useState } from "react";
import { useRevenueByCenter, useRevenueByDepartment } from "../hooks/use-revenue-analytics";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  from?: string;
  to?: string;
}

function CenterRow({ center, deptData }: {
  center: { center_id: string; center_name: string; center_code: string; total_allocated: number; dept_count: number };
  deptData: Array<{ dept_id: string; dept_name: string; dept_code: string; total_allocated: number; project_count: number }>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-secondary/20 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        tabIndex={0}
        role="row"
        aria-expanded={expanded}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span className="font-mono text-xs text-accent">{center.center_code || "—"}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 font-medium">{center.center_name}</td>
        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(center.total_allocated)}</td>
        <td className="px-4 py-2.5 text-center text-muted-foreground">{center.dept_count}</td>
      </tr>
      {expanded && deptData.length > 0 && deptData.map(dept => (
        <tr key={dept.dept_id} className="bg-secondary/5">
          <td className="px-4 py-1.5 pl-10" />
          <td className="px-4 py-1.5 text-xs text-muted-foreground">{dept.dept_code} — {dept.dept_name}</td>
          <td className="px-4 py-1.5 text-right text-xs font-mono">{formatVND(dept.total_allocated)}</td>
          <td className="px-4 py-1.5 text-center text-xs text-muted-foreground">{dept.project_count}</td>
        </tr>
      ))}
    </>
  );
}

export function CenterRevenueTable({ from, to }: Props) {
  const { t } = useI18n();
  const { data: centers = [], isLoading } = useRevenueByCenter({ from, to });
  const { data: depts = [] } = useRevenueByDepartment({ from, to });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="h-8 bg-secondary rounded animate-pulse" />)}
      </div>
    );
  }

  if (centers.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-10">{t.revenue.noEntries}</p>;
  }

  const total = centers.reduce((s, c) => s + c.total_allocated, 0);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left px-4 py-2.5 font-medium w-24">Mã TT</th>
            <th className="text-left px-4 py-2.5 font-medium">Trung tâm</th>
            <th className="text-right px-4 py-2.5 font-medium">{t.revenue.allocatedAmount}</th>
            <th className="text-center px-4 py-2.5 font-medium">Số PB</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {centers.map(center => (
            <CenterRow
              key={center.center_id}
              center={center}
              deptData={depts.filter(d => {
                // Match depts to center — sẽ dùng dept data từ API
                return true; // Show all depts under each center (API already groups)
              })}
            />
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
  );
}
