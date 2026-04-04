"use client";

import { cn } from "@/lib/utils/cn";

export function AlertCard({
  severity,
  icon,
  title,
  description,
  className,
  onClick,
}: {
  severity: "critical" | "warning" | "info";
  icon?: string;
  title: string;
  description?: string;
  className?: string;
  onClick?: () => void;
}) {
  const cfg = {
    critical: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-900/50", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
    warning:  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900/50", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
    info:     { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-900/50", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  }[severity];
  return (
    <div
      className={cn("rounded-lg border px-3 py-2 flex items-start gap-2.5", cfg.bg, cfg.border, onClick && "cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition-all", className)}
      onClick={onClick}
    >
      <span className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", cfg.dot)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs font-semibold", cfg.text)}>
          {icon && <span className="mr-1">{icon}</span>}{title}
        </p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}
