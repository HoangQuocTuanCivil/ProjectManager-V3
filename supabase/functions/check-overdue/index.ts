// supabase/functions/check-overdue/index.ts
// Runs hourly — marks overdue tasks and sends notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Mark overdue tasks
  const { data: overdue, error } = await supabase
    .from("tasks")
    .update({ status: "overdue" })
    .lt("deadline", new Date().toISOString().slice(0, 10))
    .in("status", ["pending", "in_progress", "review"])
    .select("id, title, assignee_id, assigner_id, org_id, deadline");

  // 2. Send notifications for newly overdue
  const notifications = (overdue || []).map((t) => ({
    org_id: t.org_id,
    user_id: t.assignee_id,
    title: "Công việc quá hạn",
    body: `"${t.title}" đã quá hạn ${t.deadline}`,
    type: "task_overdue",
    data: { task_id: t.id },
  }));

  // Also notify assigners
  const assignerNotifs = (overdue || []).map((t) => ({
    org_id: t.org_id,
    user_id: t.assigner_id,
    title: "Công việc giao đã quá hạn",
    body: `"${t.title}" chưa hoàn thành, quá hạn ${t.deadline}`,
    type: "task_overdue",
    data: { task_id: t.id },
  }));

  if (notifications.length > 0) {
    await supabase.from("notifications").insert([...notifications, ...assignerNotifs]);
  }

  // 3. Cleanup expired sessions
  await supabase
    .from("user_sessions")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());

  // 4. Cleanup old read notifications (> 90 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  await supabase
    .from("notifications")
    .delete()
    .eq("is_read", true)
    .lt("created_at", cutoff.toISOString());

  return new Response(
    JSON.stringify({
      success: true,
      overdue_count: overdue?.length ?? 0,
      notifications_sent: notifications.length * 2,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
