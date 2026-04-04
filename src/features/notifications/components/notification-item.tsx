"use client";

import { cn } from "@/lib/utils/cn";
import { NOTIFICATION_TYPE_CONFIG, type NotificationItem } from "../types/notification.types";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

export function NotificationCard({
  notification,
  onRead,
  onDelete,
  onClick,
}: {
  notification: NotificationItem;
  onRead?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
}) {
  const typeCfg = NOTIFICATION_TYPE_CONFIG[notification.type] || NOTIFICATION_TYPE_CONFIG.system;

  return (
    <div
      onClick={() => { onRead?.(); onClick?.(); }}
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors cursor-pointer group",
        notification.is_read
          ? "hover:bg-secondary/30"
          : "bg-primary/[0.03] hover:bg-primary/[0.06]"
      )}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{ background: `${typeCfg.color}12` }}
      >
        {typeCfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("text-sm leading-snug", !notification.is_read && "font-semibold")}>
              {notification.title}
            </p>
            {notification.body && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
            )}
          </div>

          {/* Unread dot */}
          {!notification.is_read && (
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: `${typeCfg.color}12`, color: typeCfg.color }}
          >
            {typeCfg.label}
          </span>
          <span className="text-[11px] text-muted-foreground">{timeAgo(notification.created_at)}</span>

          {/* Actions (visible on hover) */}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="ml-auto text-[11px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Data preview (project code, task title, etc.) */}
        {notification.data?.project_code && (
          <span className="inline-block mt-1 text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            {notification.data.project_code}
          </span>
        )}
      </div>
    </div>
  );
}
