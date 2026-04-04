"use client";

import { cn } from "@/lib/utils/cn";

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
