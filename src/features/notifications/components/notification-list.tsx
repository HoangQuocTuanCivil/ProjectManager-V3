"use client";

import { EmptyState } from "@/components/shared";
import { NotificationCard } from "./notification-item";
import type { NotificationGroup, NotificationItem } from "../types/notification.types";

export function NotificationList({
  groups,
  onRead,
  onDelete,
  onClick,
  isLoading,
}: {
  groups: NotificationGroup[];
  onRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (item: NotificationItem) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (groups.length === 0 || groups.every((g) => g.items.length === 0)) {
    return (
      <div className="py-12">
        <EmptyState icon="🔔" title="Không có thông báo" subtitle="Bạn sẽ nhận thông báo khi có hoạt động mới" />
      </div>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.label}>
          {/* Group Header */}
          <div className="px-4 py-2 bg-secondary/50 border-b border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
              <span className="ml-2 text-foreground">{group.items.length}</span>
            </p>
          </div>

          {/* Items */}
          <div className="divide-y divide-border/30">
            {group.items.map((item) => (
              <NotificationCard
                key={item.id}
                notification={item}
                onRead={onRead ? () => onRead(item.id) : undefined}
                onDelete={onDelete ? () => onDelete(item.id) : undefined}
                onClick={onClick ? () => onClick(item) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
