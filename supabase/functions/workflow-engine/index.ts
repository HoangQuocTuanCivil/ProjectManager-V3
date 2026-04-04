// supabase/functions/workflow-engine/index.ts
// Processes automatic workflow steps and escalations

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => ({}));
  const { task_id, action } = body;

  // 1. Process automatic steps
  const { data: autoStates } = await supabase
    .from("task_workflow_state")
    .select(`
      *, current_step:workflow_steps(*)
    `)
    .is("completed_at", null);

  const processed = [];

  for (const state of autoStates || []) {
    if (!state.current_step?.is_automatic) continue;

    // Execute automatic step
    const { data: result } = await supabase.rpc("fn_workflow_advance", {
      p_task: state.task_id,
      p_actor: null, // system
      p_result: "completed",
      p_note: "Auto-processed by workflow engine",
    });

    // Execute on_complete_actions
    const actions = state.current_step.on_complete_actions || [];
    for (const act of actions) {
      if (act.type === "notify") {
        const { data: task } = await supabase.from("tasks").select("*").eq("id", state.task_id).single();
        if (task) {
          const targetId = act.target === "assignee" ? task.assignee_id : task.assigner_id;
          if (targetId) {
            await supabase.from("notifications").insert({
              org_id: task.org_id,
              user_id: targetId,
              title: act.message || "Workflow update",
              body: `Task "${task.title}" đã chuyển bước`,
              type: "task_updated",
              data: { task_id: state.task_id },
            });
          }
        }
      } else if (act.type === "set_field" && act.field && act.value) {
        await supabase.from("tasks").update({ [act.field]: act.value }).eq("id", state.task_id);
      } else if (act.type === "calculate_kpi") {
        // Trigger KPI recalculation for this task's user
        const { data: task } = await supabase.from("tasks").select("assignee_id").eq("id", state.task_id).single();
        if (task?.assignee_id) {
          // The calculate-kpi function handles this periodically
          // Here we just mark the task as needing recalculation
          await supabase.from("tasks").update({ metadata: { needs_kpi_recalc: true } }).eq("id", state.task_id);
        }
      }
    }

    processed.push({ task_id: state.task_id, result });
  }

  // 2. Check SLA breaches
  const { data: slaStates } = await supabase
    .from("task_workflow_state")
    .select("*, current_step:workflow_steps(*)")
    .is("completed_at", null);

  const escalated = [];
  for (const state of slaStates || []) {
    if (!state.current_step?.sla_hours) continue;
    const enteredAt = new Date(state.entered_at);
    const hoursElapsed = (Date.now() - enteredAt.getTime()) / 3600000;

    if (hoursElapsed > state.current_step.sla_hours) {
      const slaAction = state.current_step.sla_action || "notify";

      if (slaAction === "auto_approve") {
        await supabase.rpc("fn_workflow_advance", {
          p_task: state.task_id,
          p_actor: null,
          p_result: "approved",
          p_note: `Auto-approved after SLA breach (${state.current_step.sla_hours}h)`,
        });
      } else {
        // Notify about SLA breach
        const { data: task } = await supabase.from("tasks").select("*").eq("id", state.task_id).single();
        if (task) {
          await supabase.from("notifications").insert({
            org_id: task.org_id,
            user_id: task.assigner_id,
            title: "SLA vượt thời hạn",
            body: `"${task.title}" đang ở bước "${state.current_step.name}" quá ${state.current_step.sla_hours}h`,
            type: "system",
            data: { task_id: state.task_id, step_id: state.current_step_id },
          });
        }
      }

      escalated.push({ task_id: state.task_id, hours: Math.round(hoursElapsed) });
    }
  }

  return new Response(
    JSON.stringify({ success: true, auto_processed: processed.length, sla_escalated: escalated.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
