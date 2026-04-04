"use client";

import { STATUS_CONFIG } from "@/lib/utils/kpi";
import type { TaskStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[5px] text-xs font-medium"
      style={{ background: `${cfg.color}18`, color: cfg.color }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}
