"use client";

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded bg-secondary text-muted-foreground text-[11px] font-medium">
      {children}
    </span>
  );
}
