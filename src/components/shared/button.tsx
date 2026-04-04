"use client";

import { cn } from "@/lib/utils/cn";

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
