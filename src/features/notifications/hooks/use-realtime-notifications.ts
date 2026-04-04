import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useNotifStore } from "@/lib/stores";
import { notificationKeys } from "./use-notifications";

export function useRealtimeNotifications(userId: string | undefined) {
  const qc = useQueryClient();
  const { setUnreadCount, unreadCount } = useNotifStore();
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Invalidate queries to refetch
          qc.invalidateQueries({ queryKey: notificationKeys.all });
          // Increment unread count
          setUnreadCount(useNotifStore.getState().unreadCount + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, qc, setUnreadCount]);
}
