import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores";
import type { NotificationItem, NotificationGroup } from "../types/notification.types";

const supabase = createClient();

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filter?: string) => [...notificationKeys.all, "list", filter] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
};

export function useNotificationList(filter?: string) {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: notificationKeys.list(filter),
    queryFn: async () => {
      if (!user?.id) return [] as NotificationItem[];
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter === "unread") query = query.eq("is_read", false);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as NotificationItem[];
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}

export function useNotificationUnreadCount() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Chưa đăng nhập");
      
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
        
      if (error) throw error;
    },
    onMutate: async () => {
      // Cancel all notification queries
      await qc.cancelQueries({ queryKey: notificationKeys.all });

      // Snapshot all current notification data for rollback
      const previousData = qc.getQueriesData({ queryKey: notificationKeys.all });

      // Optimistically mark all notifications as read for lists
      qc.setQueriesData<NotificationItem[]>(
        { queryKey: notificationKeys.list() },
        (old) => Array.isArray(old) ? old.map((n) => ({ ...n, is_read: true })) : old
      );
      
      // Optimistically set unread count to 0
      qc.setQueriesData<number>(
        { queryKey: notificationKeys.unread() },
        () => 0
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// Group notifications by date
export function groupNotifications(items: NotificationItem[]): NotificationGroup[] {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  const groups = new Map<string, NotificationItem[]>();

  items.forEach((item) => {
    const date = new Date(item.created_at);
    const dateStr = date.toDateString();
    let label: string;

    if (dateStr === today) label = "Hôm nay";
    else if (dateStr === yesterday) label = "Hôm qua";
    else {
      const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
      if (diff < 7) label = "Tuần này";
      else label = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    const existing = groups.get(label) || [];
    existing.push(item);
    groups.set(label, existing);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
