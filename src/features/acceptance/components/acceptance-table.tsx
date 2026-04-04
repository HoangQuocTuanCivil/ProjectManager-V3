"use client";

import { UserAvatar, KPIRing, VerdictBadge } from "@/components/shared";
import { ROLE_CONFIG, formatDate, formatVND } from "@/lib/utils/kpi";
import { PaymentStatusBadge } from "./payment-status";
import type { AcceptanceRecord } from "../types/acceptance.types";

export function AcceptanceTable({
  records,
  onSelect,
  showProject = false,
  showPayment = false,
}: {
  records: AcceptanceRecord[];
  onSelect?: (record: AcceptanceRecord) => void;
  showProject?: boolean;
  showPayment?: boolean;
}) {
  if (records.length === 0) return null;

  const headers = [
    ...(showProject ? ["Dự án"] : []),
    "Sản phẩm",
    "Người thực hiện",
    "KPI E",
    "KPI A",
    "Δ",
    "Kết quả",
    ...(showPayment ? ["Thanh toán", "Số tiền"] : []),
    "Ngày NT",
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.id}
              onClick={() => onSelect?.(record)}
              className={`border-b border-border/40 transition-colors ${onSelect ? "hover:bg-secondary/30 cursor-pointer" : ""}`}
            >
              {showProject && (
                <td className="px-4 py-2.5">
                  {record.project ? (
                    <span className="font-mono text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                      {record.project.code}
                    </span>
                  ) : <span className="text-sm text-muted-foreground">—</span>}
                </td>
              )}
              <td className="px-4 py-2.5">
                <p className="text-sm font-medium truncate max-w-[220px]">{record.task.title}</p>
                <p className="text-[11px] text-muted-foreground">W:{record.task.kpi_weight}</p>
              </td>
              <td className="px-4 py-2.5">
                {record.assignee ? (
                  <div className="flex items-center gap-1.5">
                    <UserAvatar name={record.assignee.full_name} color={ROLE_CONFIG[record.assignee.role]?.color} size="xs" />
                    <span className="text-sm truncate max-w-[80px]">{record.assignee.full_name}</span>
                  </div>
                ) : <span className="text-sm text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <KPIRing score={record.expect_score} size={24} strokeWidth={2} />
                  <span className="font-mono text-sm">{Math.round(record.expect_score)}</span>
                </div>
              </td>
              <td className="px-4 py-2.5">
                {record.evaluated_at ? (
                  <div className="flex items-center gap-1">
                    <KPIRing score={record.actual_score} size={24} strokeWidth={2} />
                    <span className="font-mono text-sm font-bold">{Math.round(record.actual_score)}</span>
                  </div>
                ) : <span className="text-sm text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-2.5">
                {record.evaluated_at ? (
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: record.kpi_variance >= 0 ? "#10b981" : "#ef4444" }}
                  >
                    {record.kpi_variance >= 0 ? "+" : ""}{Math.round(record.kpi_variance)}
                  </span>
                ) : <span className="text-sm text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-2.5">
                <VerdictBadge verdict={record.verdict} />
              </td>
              {showPayment && (
                <>
                  <td className="px-4 py-2.5">
                    <PaymentStatusBadge status={record.payment_status} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm text-amber-500 font-semibold">
                    {record.payment_amount ? formatVND(record.payment_amount) : "—"}
                  </td>
                </>
              )}
              <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">
                {record.evaluated_at ? formatDate(record.evaluated_at) : "Chờ NT"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
