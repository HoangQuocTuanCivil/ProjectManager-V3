import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "./client";
import { taskKeys } from "@/features/tasks";
import { notificationKeys } from "@/features/notifications/hooks/use-notifications";

export function useRealtimeSubscriptions(userId: string) {
  const qc = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;

    const taskChannel = supabase
      .channel("tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: taskKeys.lists() });
      })
      .subscribe();

    const notifChannel = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: notificationKeys.all });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [userId, supabase, qc]);
}
