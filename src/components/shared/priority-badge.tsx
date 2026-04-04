"use client";

import { PRIORITY_CONFIG } from "@/lib/utils/kpi";
import type { TaskPriority } from "@/lib/types";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className="text-[11.5px] font-medium" style={{ color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}
