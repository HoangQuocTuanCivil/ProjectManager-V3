"use client";

export function TrendIndicator({ value, suffix = "%", positive = true }: { value: number; suffix?: string; positive?: boolean }) {
  if (value === 0) return <span className="text-[11px] text-muted-foreground font-medium">— 0{suffix}</span>;
  const isUp = positive ? value > 0 : value < 0;
  const color = isUp ? "#10b981" : "#ef4444";
  const arrow = value > 0 ? "↑" : "↓";
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color }}>
      {arrow} {Math.abs(value)}{suffix}
    </span>
  );
}
