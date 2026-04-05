"use client";

import type { ReactNode } from "react";

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="text-base font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-md">{subtitle}</p>}
    </div>
  );
}
