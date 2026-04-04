// Hooks thông báo: danh sách, đếm chưa đọc, đánh dấu đã đọc

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export const notifKeys = {
  all: ["notifications"] as const,
  list: () => [...notifKeys.all, "list"] as const,
  unread: () => [...notifKeys.all, "unread"] as const,
};

/** Lấy 50 thông báo gần nhất */
export function useNotifications() {
  return useQuery({
    queryKey: notifKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

/** Đếm số thông báo chưa đọc, tự refresh mỗi 30 giây */
export function useUnreadCount() {
  return useQuery({
    queryKey: notifKeys.unread(),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
}

/** Đánh dấu 1 thông báo đã đọc */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.list() });
      qc.invalidateQueries({ queryKey: notifKeys.unread() });
    },
  });
}

/** Đánh dấu tất cả thông báo đã đọc */
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.list() });
      qc.invalidateQueries({ queryKey: notifKeys.unread() });
    },
  });
}
