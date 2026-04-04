"use client";

import { cn } from "@/lib/utils/cn";

export function ProgressBar({ value, showText = true, className }: { value: number; showText?: boolean; className?: string }) {
  const color = value >= 80 ? "#10b981" : value >= 40 ? "#38bdf8" : "#f59e0b";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="w-20 h-[5px] bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${value}%`, background: color }} />
      </div>
      {showText && <span className="text-xs font-mono text-muted-foreground">{value}%</span>}
    </div>
  );
}
