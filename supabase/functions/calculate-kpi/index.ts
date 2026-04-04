// supabase/functions/calculate-kpi/index.ts
// Runs daily via cron — calculates KPI for all active users
// Triggered by: pg_cron or Supabase scheduled function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: orgs } = await supabase.from("organizations").select("id");

    const results = [];

    for (const org of orgs || []) {
      // Get allocation config
      const { data: config } = await supabase
        .from("allocation_configs")
        .select("*")
        .eq("org_id", org.id)
        .eq("is_active", true)
        .single();

      const wVol = config?.weight_volume ?? 0.4;
      const wQual = config?.weight_quality ?? 0.3;
      const wDiff = config?.weight_difficulty ?? 0.2;
      const wAhd = config?.weight_ahead ?? 0.1;

      // Get active users
      const { data: users } = await supabase
        .from("users")
        .select("id, dept_id")
        .eq("org_id", org.id)
        .eq("is_active", true);

      const periodStart = new Date();
      periodStart.setDate(1); // First of current month
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      for (const user of users || []) {
        // Get user's tasks for current period
        const { data: tasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("assignee_id", user.id)
          .neq("status", "cancelled")
          .gte("created_at", periodStart.toISOString())
          .lt("created_at", periodEnd.toISOString());

        if (!tasks?.length) continue;

        const totalWeight = tasks.reduce((s, t) => s + t.kpi_weight, 0);
        const completed = tasks.filter((t) => t.status === "completed");
        const overdue = tasks.filter((t) => t.status === "overdue");

        // Calculate weighted score using actual if evaluated, else expected
        let score = 0;
        if (totalWeight > 0) {
          const weightedSum = tasks.reduce((s, t) => {
            const useActual = t.kpi_evaluated_at != null;
            const sc = useActual ? t.actual_score : t.expect_score;
            return s + (sc || 0) * t.kpi_weight;
          }, 0);
          score = weightedSum / totalWeight;
        }

        // Upsert KPI record
        await supabase.from("kpi_records").upsert(
          {
            org_id: org.id,
            user_id: user.id,
            dept_id: user.dept_id,
            period: "month",
            period_start: periodStart.toISOString().slice(0, 10),
            period_end: periodEnd.toISOString().slice(0, 10),
            tasks_assigned: tasks.length,
            tasks_completed: completed.length,
            tasks_overdue: overdue.length,
            tasks_on_time: completed.filter(
              (t) => t.completed_at && t.deadline && new Date(t.completed_at) <= new Date(t.deadline + "T23:59:59")
            ).length,
            score: Math.round(score * 100) / 100,
            breakdown: {
              total_weight: totalWeight,
              tasks: tasks.map((t) => ({
                id: t.id,
                title: t.title,
                weight: t.kpi_weight,
                expect: t.expect_score,
                actual: t.actual_score,
                variance: t.kpi_variance,
                evaluated: !!t.kpi_evaluated_at,
              })),
            },
            calculated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,period,period_start" }
        );

        results.push({ user_id: user.id, score, tasks: tasks.length });
      }
    }

    return new Response(JSON.stringify({ success: true, calculated: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
