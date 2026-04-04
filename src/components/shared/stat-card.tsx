"use client";

import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  subtitle,
  color,
  accentColor,
  onClick,
  onSubtitleClick,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  accentColor?: string;
  onClick?: () => void;
  onSubtitleClick?: () => void;
}) {
  return (
    <div
      className={cn("bg-card border border-border rounded-xl p-4 relative overflow-hidden transition-all", onClick && "cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40 active:translate-y-0 focus-ring")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      aria-label={onClick ? `${label}: ${value}` : undefined}
    >
      {accentColor && (
        <div className="absolute top-0 left-0 right-0 h-[2.5px]" style={{ background: accentColor }} />
      )}
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-[0.6px]">{label}</p>
      <p className="text-[26px] font-bold font-mono mt-1.5 -tracking-[0.5px]" style={{ color: accentColor ?? color }}>
        {value}
      </p>
      {subtitle && (
        onSubtitleClick ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSubtitleClick(); }}
            className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
          >
            {subtitle}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )
      )}
    </div>
  );
}
