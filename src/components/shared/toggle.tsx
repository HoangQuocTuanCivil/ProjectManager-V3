"use client";

import { cn } from "@/lib/utils/cn";

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
