"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useNotificationList,
  useNotificationUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  groupNotifications,
} from "../hooks/use-notifications";
import { NotificationList } from "./notification-list";
import { toast } from "sonner";

export function NotificationBell() {
  const router = useRouter();
  const { data: unreadCount = 0 } = useNotificationUnreadCount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = useNotificationList();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const groups = groupNotifications(notifications.slice(0, 20));
  const recentUnread = notifications.filter((n) => !n.is_read).length;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative w-8 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-[380px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-slide-in-bottom">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">Thông báo</h3>
              {recentUnread > 0 && (
                <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                  {recentUnread} mới
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {recentUnread > 0 && (
                <button
                  onClick={() => markAllRead.mutate(undefined, {
                    onSuccess: () => toast.success("Đã đánh dấu tất cả đã đọc"),
                    onError: (e: any) => toast.error(e.message || "Lỗi đánh dấu đã đọc"),
                  })}
                  className="text-[11px] text-primary hover:underline"
                >
                  Đọc tất cả
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            <NotificationList
              groups={groups}
              onRead={(id) => markRead.mutate(id)}
              isLoading={isLoading}
            />
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-secondary/30">
            <button
              onClick={() => { router.push("/notifications"); setOpen(false); }}
              className="text-sm text-primary hover:underline w-full text-center"
            >
              Xem tất cả thông báo →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
