"use client";

import { ROLE_CONFIG } from "@/lib/utils/kpi";
import type { UserRole } from "@/lib/types";

export function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-[5px] text-[10.5px] font-medium"
      style={{ background: `${cfg.color}20`, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}
