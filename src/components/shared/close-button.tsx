"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Accessible close button for modals, panels, and drawers. Replaces bare "x"
 * characters that lack screen reader labels. The aria-label defaults to "Dong"
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
