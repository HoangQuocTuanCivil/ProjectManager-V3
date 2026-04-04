"use client";

import type { HealthScore } from "@/lib/types";

const HEALTH_MAP: Record<HealthScore, { label: string; color: string }> = {
  green: { label: "Tốt", color: "#10b981" },
  yellow: { label: "Cần chú ý", color: "#f59e0b" },
  red: { label: "Nguy cơ", color: "#ef4444" },
  gray: { label: "—", color: "#94a3b8" },
};

export function HealthBadge({ health }: { health: HealthScore }) {
  const cfg = HEALTH_MAP[health];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}
