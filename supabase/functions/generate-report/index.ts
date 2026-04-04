// supabase/functions/generate-report/index.ts
// Generates weekly/monthly status reports per project/department

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { period = "week", project_id, org_id } = await req.json().catch(() => ({}));

  const now = new Date();
  const start = new Date(now);
  if (period === "week") start.setDate(start.getDate() - 7);
  else if (period === "month") start.setMonth(start.getMonth() - 1);
  else start.setFullYear(start.getFullYear() - 1);

  let query = supabase.from("tasks").select("*").gte("updated_at", start.toISOString()).neq("status", "cancelled");
  if (project_id) query = query.eq("project_id", project_id);
  if (org_id) query = query.eq("org_id", org_id);

  const { data: tasks = [] } = await query;

  const total = tasks.length;
  const completed = tasks.filter((t: any) => t.status === "completed").length;
  const overdue = tasks.filter((t: any) => t.status === "overdue").length;
  const inProgress = tasks.filter((t: any) => t.status === "in_progress").length;
  const evaluated = tasks.filter((t: any) => t.kpi_evaluated_at);
  const avgKPI = evaluated.length > 0 ? Math.round(evaluated.reduce((s: number, t: any) => s + (t.actual_score || 0), 0) / evaluated.length) : 0;

  const highlights = tasks
    .filter((t: any) => t.status === "completed" && (t.kpi_variance ?? 0) >= 0)
    .slice(0, 5)
    .map((t: any) => ({ text: `${t.title} — KPI: ${Math.round(t.actual_score)}`, task_id: t.id }));

  const blockers = tasks
    .filter((t: any) => t.status === "overdue")
    .slice(0, 5)
    .map((t: any) => ({ text: `${t.title} — quá hạn ${t.deadline}`, task_id: t.id }));

  const health = overdue / Math.max(total, 1) > 0.2 ? "red" : overdue > 0 ? "yellow" : "green";

  // Create status update
  if (project_id) {
    await supabase.from("status_updates").insert({
      project_id,
      title: `Báo cáo ${period === "week" ? "tuần" : "tháng"} — ${now.toLocaleDateString("vi-VN")}`,
      summary: `${completed}/${total} tasks hoàn thành, ${overdue} quá hạn, KPI TB: ${avgKPI}`,
      health,
      highlights,
      blockers,
      metrics: { total, completed, overdue, in_progress: inProgress, avg_kpi: avgKPI },
      author_id: null, // system generated
      published_at: now.toISOString(),
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      period, total, completed, overdue, in_progress: inProgress, avg_kpi: avgKPI,
      health, highlights_count: highlights.length, blockers_count: blockers.length,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
