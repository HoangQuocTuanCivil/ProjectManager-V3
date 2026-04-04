"use client";

export function KPIScoreBar({
  label,
  value,
  maxValue = 100,
  color,
  weight,
}: {
  label: string;
  value: number;
  maxValue?: number;
  color: string;
  weight?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(value / maxValue) * 100}%`, background: color }} />
      </div>
      <span className="font-mono font-medium w-7 text-right" style={{ color }}>
        {value}
      </span>
      {weight && <span className="text-muted-foreground text-[11px] w-8">({weight})</span>}
    </div>
  );
}
