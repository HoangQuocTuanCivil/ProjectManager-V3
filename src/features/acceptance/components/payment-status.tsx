"use client";

import type { PaymentStatus } from "../types/acceptance.types";

const PAYMENT_CONFIG: Record<PaymentStatus, { label: string; color: string; icon: string }> = {
  unpaid: { label: "Chưa thanh toán", color: "#94a3b8", icon: "○" },
  pending_payment: { label: "Chờ chi", color: "#f59e0b", icon: "◉" },
  paid: { label: "Đã chi", color: "#10b981", icon: "●" },
  rejected: { label: "Từ chối", color: "#ef4444", icon: "✕" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = PAYMENT_CONFIG[status] || PAYMENT_CONFIG.unpaid;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium"
      style={{ background: `${cfg.color}15`, color: cfg.color }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

export function PaymentSummaryCard({
  totalAmount,
  paidAmount,
  pendingCount,
}: {
  totalAmount: number;
  paidAmount: number;
  pendingCount: number;
}) {
  const pct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider mb-2">Thanh toán</p>
      <div className="flex items-end gap-2 mb-2">
        <span className="font-mono text-xl font-bold text-amber-500">
          {Math.round(paidAmount).toLocaleString("vi-VN")}đ
        </span>
        <span className="text-sm text-muted-foreground mb-0.5">
          / {Math.round(totalAmount).toLocaleString("vi-VN")}đ
        </span>
      </div>
      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: pct >= 100 ? "#10b981" : "#f59e0b" }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{pct}% đã chi</span>
        <span>{pendingCount} đang chờ</span>
      </div>
    </div>
  );
}
