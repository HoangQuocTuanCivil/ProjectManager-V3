// supabase/functions/process-automation/index.ts
// Evaluates and executes automation rules
// Triggered by: cron or webhook events

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
    const body = await req.json().catch(() => ({}));
    const { trigger_event, resource_type, resource_id } = body;

    // Get active automation rules
    let rulesQuery = supabase
      .from("automation_rules")
      .select("*")
      .eq("is_active", true);

    if (trigger_event) {
      rulesQuery = rulesQuery.eq("trigger_event", trigger_event);
    }

    const { data: rules, error: rulesErr } = await rulesQuery;
    if (rulesErr) throw rulesErr;

    const results = [];

    for (const rule of rules || []) {
      try {
        const matched = evaluateCondition(rule.conditions, { trigger_event, resource_type, resource_id });
        if (!matched) continue;

        const actionResults = await executeActions(supabase, rule.actions, {
          trigger_event,
          resource_type,
          resource_id,
          rule_id: rule.id,
        });

        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          matched: true,
          actions_executed: actionResults.length,
          results: actionResults,
        });

        // Log execution
        await supabase.from("automation_logs").insert({
          rule_id: rule.id,
          trigger_event: trigger_event || "manual",
          resource_type,
          resource_id,
          result: "success",
          details: { actions: actionResults },
        });
      } catch (ruleErr) {
        // Log failure but continue
        await supabase.from("automation_logs").insert({
          rule_id: rule.id,
          trigger_event: trigger_event || "manual",
          resource_type,
          resource_id,
          result: "error",
          details: { error: ruleErr.message },
        });

        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          matched: true,
          error: ruleErr.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rules_evaluated: (rules || []).length,
        rules_matched: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Condition Evaluator ────────────────────────────────────────────────
function evaluateCondition(conditions: any, context: any): boolean {
  if (!conditions) return true;
  if (typeof conditions !== "object") return true;

  // Simple condition matching: { field: value } or { field: { op: value } }
  for (const [field, expected] of Object.entries(conditions)) {
    const actual = context[field];

    if (typeof expected === "object" && expected !== null) {
      const ops = expected as Record<string, any>;
      if (ops.eq !== undefined && actual !== ops.eq) return false;
      if (ops.neq !== undefined && actual === ops.neq) return false;
      if (ops.in !== undefined && !ops.in.includes(actual)) return false;
      if (ops.gt !== undefined && !(actual > ops.gt)) return false;
      if (ops.lt !== undefined && !(actual < ops.lt)) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

// ─── Action Executor ────────────────────────────────────────────────────
async function executeActions(supabase: any, actions: any[], context: any): Promise<any[]> {
  const results = [];

  for (const action of actions || []) {
    switch (action.type) {
      case "notify": {
        const { data } = await supabase.from("notifications").insert({
          user_id: action.user_id || context.resource_id,
          title: action.title || "Thông báo tự động",
          body: action.body || null,
          type: "system",
          data: { automation_rule_id: context.rule_id, ...action.data },
        });
        results.push({ type: "notify", success: true });
        break;
      }

      case "update_field": {
        if (action.table && action.id && action.field && action.value !== undefined) {
          await supabase
            .from(action.table)
            .update({ [action.field]: action.value })
            .eq("id", action.id || context.resource_id);
          results.push({ type: "update_field", table: action.table, field: action.field, success: true });
        }
        break;
      }

      case "create_task": {
        const { data, error } = await supabase.from("tasks").insert({
          org_id: action.org_id,
          title: action.title || "Task tự động",
          description: action.description,
          assignee_id: action.assignee_id,
          priority: action.priority || "medium",
          task_type: action.task_type || "task",
          kpi_weight: action.kpi_weight || 5,
          expect_volume: 100,
          expect_quality: action.expect_quality || 80,
          expect_difficulty: action.expect_difficulty || 50,
          expect_ahead: 50,
          deadline: action.deadline,
          metadata: { created_by_automation: context.rule_id },
        }).select().single();
        results.push({ type: "create_task", success: !error, task_id: data?.id });
        break;
      }

      case "invoke_function": {
        if (action.function_name) {
          const { data, error } = await supabase.functions.invoke(action.function_name, {
            body: action.params || {},
          });
          results.push({ type: "invoke_function", fn: action.function_name, success: !error });
        }
        break;
      }

      default:
        results.push({ type: action.type, success: false, error: "Unknown action type" });
    }
  }

  return results;
}
