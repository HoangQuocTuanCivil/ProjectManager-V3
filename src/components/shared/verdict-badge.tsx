"use client";

import { VERDICT_CONFIG } from "@/lib/utils/kpi";
import type { KPIVerdict } from "@/lib/types";

export function VerdictBadge({ verdict }: { verdict: KPIVerdict }) {
  const cfg = VERDICT_CONFIG[verdict];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}
