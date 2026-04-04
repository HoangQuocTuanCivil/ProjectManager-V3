// supabase/functions/calculate-allocation/index.ts
// Calculates allocation results for a given period
// Triggered by: API route POST /api/kpi/allocation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { period_id, use_actual = true } = await req.json();

    if (!period_id) {
      return new Response(JSON.stringify({ error: "period_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get period with config
    const { data: period, error: periodErr } = await supabase
      .from("allocation_periods")
      .select("*, config:allocation_configs(*)")
      .eq("id", period_id)
      .single();

    if (periodErr || !period) {
      return new Response(JSON.stringify({ error: "Period not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = period.config;
    const weights = {
      volume: config?.weight_volume ?? 0.4,
      quality: config?.weight_quality ?? 0.3,
      difficulty: config?.weight_difficulty ?? 0.2,
      ahead: config?.weight_ahead ?? 0.1,
    };

    // Get tasks in period
    let taskQuery = supabase
      .from("tasks")
      .select("*")
      .eq("org_id", period.org_id)
      .gte("created_at", period.period_start)
      .lte("created_at", period.period_end)
      .in("status", ["completed", "review"]);

    if (period.project_id) {
      taskQuery = taskQuery.eq("project_id", period.project_id);
    }

    const { data: tasks, error: taskErr } = await taskQuery;
    if (taskErr) throw taskErr;

    // Group by assignee and calculate scores
    const userScores = new Map();

    for (const task of tasks || []) {
      if (!task.assignee_id) continue;

      const existing = userScores.get(task.assignee_id) || {
        user_id: task.assignee_id,
        project_id: period.project_id,
        mode: period.mode,
        total_weight: 0,
        sum_volume: 0,
        sum_quality: 0,
        sum_difficulty: 0,
        sum_ahead: 0,
        task_count: 0,
        expect_sum: 0,
      };

      const w = task.kpi_weight || 1;
      const scoreField = use_actual && task.kpi_evaluated_at ? "actual" : "expect";

      existing.total_weight += w;
      existing.sum_volume += (task[`${scoreField}_volume`] || 0) * w;
      existing.sum_quality += (task[`${scoreField}_quality`] || 0) * w;
      existing.sum_difficulty += (task[`${scoreField}_difficulty`] || 0) * w;
      existing.sum_ahead += (task[`${scoreField}_ahead`] || 0) * w;
      existing.task_count += 1;
      existing.expect_sum += (task.expect_score || 0) * w;

      userScores.set(task.assignee_id, existing);
    }

    // Calculate weighted scores and allocate
    const results = [];
    let totalWeightedScore = 0;

    for (const [userId, scores] of userScores) {
      if (scores.total_weight === 0) continue;

      const avgV = scores.sum_volume / scores.total_weight;
      const avgQ = scores.sum_quality / scores.total_weight;
      const avgD = scores.sum_difficulty / scores.total_weight;
      const avgA = scores.sum_ahead / scores.total_weight;

      const weightedScore = avgV * weights.volume + avgQ * weights.quality + avgD * weights.difficulty + avgA * weights.ahead;

      results.push({
        period_id,
        user_id: userId,
        project_id: period.project_id,
        mode: period.mode,
        avg_volume: Math.round(avgV),
        avg_quality: Math.round(avgQ),
        avg_difficulty: Math.round(avgD),
        avg_ahead: Math.round(avgA),
        weighted_score: Math.round(weightedScore * 100) / 100,
        task_count: scores.task_count,
        breakdown: {
          expect_score: Math.round(scores.expect_sum / scores.total_weight),
          total_weight: scores.total_weight,
        },
      });

      totalWeightedScore += weightedScore;
    }

    // Calculate shares and amounts
    for (const r of results) {
      r.share_percentage = totalWeightedScore > 0
        ? Math.round((r.weighted_score / totalWeightedScore) * 10000) / 10000
        : 0;
      r.allocated_amount = Math.round(r.share_percentage * period.total_fund);
    }

    // Delete old results and insert new
    await supabase.from("allocation_results").delete().eq("period_id", period_id);
    if (results.length > 0) {
      const { error: insertErr } = await supabase.from("allocation_results").insert(results);
      if (insertErr) throw insertErr;
    }

    // Update period status
    await supabase
      .from("allocation_periods")
      .update({ status: "calculated" })
      .eq("id", period_id);

    return new Response(
      JSON.stringify({ success: true, users: results.length, total_score: totalWeightedScore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
