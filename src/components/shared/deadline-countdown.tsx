"use client";

export function DeadlineCountdown({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="text-[11px] text-muted-foreground">—</span>;
  const now = new Date();
  const dl = new Date(deadline + (deadline.includes("T") ? "" : "T23:59:59"));
  const diffMs = dl.getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86400000);
  if (days < 0) {
    return <span className="text-[11px] font-semibold text-red-500">Quá hạn {Math.abs(days)}d</span>;
  }
  if (days === 0) {
    return <span className="text-[11px] font-semibold text-red-500">Hôm nay</span>;
  }
  if (days <= 3) {
    return <span className="text-[11px] font-semibold text-amber-500">Còn {days}d</span>;
  }
  if (days <= 7) {
    return <span className="text-[11px] font-medium text-blue-500">Còn {days}d</span>;
  }
  return <span className="text-[11px] text-muted-foreground">Còn {days}d</span>;
}
