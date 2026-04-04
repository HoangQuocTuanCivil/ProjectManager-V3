"use client";

import { cn } from "@/lib/utils/cn";
import { STATUS_CONFIG, PRIORITY_CONFIG, ROLE_CONFIG, VERDICT_CONFIG } from "@/lib/utils/kpi";
import type { TaskStatus, TaskPriority, UserRole, HealthScore, KPIVerdict } from "@/lib/types";


export function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[5px] text-xs font-medium"
      style={{ background: `${cfg.color}18`, color: cfg.color }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}


export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className="text-[11.5px] font-medium" style={{ color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}


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


export function UserAvatar({
  name,
  color,
  size = "sm",
  src,
}: {
  name: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg";
  src?: string | null;
}) {
  const sizes = { xs: "w-6 h-6 text-[8px]", sm: "w-7 h-8 text-[10px]", md: "w-9 h-9 text-xs", lg: "w-11 h-11 text-sm" };
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("");

  if (src) {
    return <img src={src} alt={name} className={cn("rounded-full object-cover", sizes[size])} />;
  }

  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold text-white flex-shrink-0", sizes[size])}
      style={{ background: color ?? "#6366f1" }}
      title={name}
    >
      {initials}
    </div>
  );
}


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


export function KPIRing({
  score,
  size = 48,
  strokeWidth = 4,
  label,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(score, 100) / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono font-bold"
        style={{ color, fontSize: size * 0.28 }}
      >
        {Math.round(score)}
      </div>
    </div>
  );
}


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


export function StatCard({
  label,
  value,
  subtitle,
  color,
  accentColor,
  onClick,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  accentColor?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn("bg-card border border-border rounded-xl p-4 relative overflow-hidden", onClick && "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all focus-ring rounded-xl")}
      onClick={onClick}
      /* When onClick is present, the div acts as a button — add keyboard and ARIA support */
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
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}


export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-xl", className)}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}


export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded bg-secondary text-muted-foreground text-[11px] font-medium">
      {children}
    </span>
  );
}


export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-3xl mb-3">{icon}</span>
      <p className="text-base font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}


export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full border text-xs font-[450] transition-all",
        active
          ? "bg-primary/12 border-primary text-primary font-semibold"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}


export function Button({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: {
  variant?: "default" | "primary" | "ghost" | "destructive";
  size?: "default" | "sm" | "xs";
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    default: "bg-secondary text-muted-foreground border border-border hover:text-foreground hover:border-border/80",
    primary: "bg-primary text-primary-foreground hover:brightness-110",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary",
    destructive: "bg-destructive text-white hover:brightness-110",
  };
  const sizes = {
    default: "px-4 py-2 text-sm",
    sm: "px-3 py-1.5 text-[12px]",
    xs: "px-2 py-1 text-xs",
  };
  return (
    <button
      className={cn(
        "rounded-md font-semibold transition-all inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}


export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      /* Expose toggle state to assistive technology via the switch role */
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "w-8 h-[18px] rounded-full relative transition-colors flex-shrink-0 focus-ring",
        checked ? "bg-green-500" : "bg-muted-foreground/40"
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform",
          checked && "translate-x-[14px]"
        )}
      />
    </button>
  );
}


/**
 * Accessible close button for modals, panels, and drawers. Replaces bare "×"
 * characters that lack screen reader labels. The aria-label defaults to "Đóng"
 * (Vietnamese for "Close") to match the application's primary locale.
 */
export function CloseButton({ onClick, label = "Đóng", className }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn("text-muted-foreground hover:text-foreground text-lg leading-none p-1 rounded focus-ring", className)}
    >
      ✕
    </button>
  );
}


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
