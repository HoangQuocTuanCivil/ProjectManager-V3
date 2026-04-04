import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "./client";
import { taskKeys } from "@/lib/hooks/use-tasks";
import { useNotifStore } from "@/lib/stores";

export function useRealtimeSubscriptions(userId: string) {
  const qc = useQueryClient();
  const { setUnreadCount } = useNotifStore();
  const supabase = createClient();

  // Fetch initial unread count
  useEffect(() => {
    if (!userId) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (count !== null) setUnreadCount(count);
    };
    fetchUnread();
  }, [userId, supabase, setUnreadCount]);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to task changes
    const taskChannel = supabase
      .channel("tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: taskKeys.lists() });
      })
      .subscribe();

    // Subscribe to notifications — INSERT, UPDATE, DELETE
    const notifChannel = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        setUnreadCount(useNotifStore.getState().unreadCount + 1);
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        // Re-fetch unread count
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false)
          .then(({ count }) => { if (count !== null) setUnreadCount(count); });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [userId, supabase, qc, setUnreadCount]);
}
