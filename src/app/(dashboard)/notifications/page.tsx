"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatCard, FilterChip, Button } from "@/components/shared";
import { useNotifStore } from "@/lib/stores";
import {
  useNotificationList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  groupNotifications,
  NotificationList,
  NOTIFICATION_TYPE_CONFIG,
  type NotificationItem,
  type NotificationType,
} from "@/features/notifications";

type FilterKey = "all" | "unread" | NotificationType;

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const { setUnreadCount } = useNotifStore();

  const { data: notifications = [], isLoading } = useNotificationList(filter === "unread" ? "unread" : undefined);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotif = useDeleteNotification();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Client-side type filter
  const filtered = filter === "all" || filter === "unread"
    ? notifications
    : notifications.filter((n) => n.type === filter);

  const groups = groupNotifications(filtered);

  // Type counts for filters
  const typeCounts = new Map<string, number>();
  notifications.forEach((n) => {
    typeCounts.set(n.type, (typeCounts.get(n.type) || 0) + 1);
  });

  const handleClick = (item: NotificationItem) => {
    if (!item.is_read) markRead.mutate(item.id);
    // Navigate based on type
    if (item.data?.task_id) router.push(`/tasks/${item.data.task_id}`);
    else if (item.data?.project_id) router.push(`/projects/${item.data.project_id}`);
    else if (item.data?.goal_id) router.push(`/goals/${item.data.goal_id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Thông báo</h1>
          <p className="text-base text-muted-foreground mt-0.5">
            {notifications.length} thông báo · {unreadCount} chưa đọc
          </p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" onClick={() => markAllRead.mutate(undefined, {
            onSuccess: () => {
              setUnreadCount(0);
              toast.success("Đã đánh dấu tất cả đã đọc");
            },
            onError: (e: any) => toast.error(e.message || "Lỗi đánh dấu đã đọc"),
          })} disabled={markAllRead.isPending}>
            {markAllRead.isPending ? "..." : "Đánh dấu tất cả đã đọc"}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Tổng" value={notifications.length} accentColor="hsl(var(--primary))" />
        <StatCard label="Chưa đọc" value={unreadCount} accentColor="#f59e0b" />
        <StatCard label="Hôm nay" value={notifications.filter((n) => new Date(n.created_at).toDateString() === new Date().toDateString()).length} accentColor="#3b82f6" />
        <StatCard label="Loại" value={typeCounts.size} accentColor="#10b981" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Tất cả ({notifications.length})
        </FilterChip>
        <FilterChip active={filter === "unread"} onClick={() => setFilter("unread")}>
          Chưa đọc ({unreadCount})
        </FilterChip>

        <div className="w-px h-5 bg-border mx-1" />

        {Array.from(typeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([type, count]) => {
            const cfg = NOTIFICATION_TYPE_CONFIG[type];
            if (!cfg) return null;
            return (
              <FilterChip key={type} active={filter === type} onClick={() => setFilter(type as NotificationType)}>
                {cfg.icon} {cfg.label} ({count})
              </FilterChip>
            );
          })}
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <NotificationList
          groups={groups}
          onRead={(id) => markRead.mutate(id)}
          onDelete={(id) => deleteNotif.mutate(id)}
          onClick={handleClick}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
