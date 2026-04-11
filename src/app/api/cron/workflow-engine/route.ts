import { NextRequest } from "next/server";
import { verifyCronSecret, getUntypedAdmin, jsonResponse, errorResponse } from "@/lib/api/helpers";

interface StepRecord {
  is_automatic: boolean;
  sla_hours: number | null;
  sla_action: string | null;
  on_complete_actions: Array<{ type: string; target?: string; message?: string; field?: string; value?: unknown }> | null;
  name: string;
}

interface WorkflowState {
  task_id: string;
  current_step_id: string;
  entered_at: string;
  current_step: StepRecord | null;
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return errorResponse("Unauthorized", 401);
  }

  const admin = getUntypedAdmin();

  const { data: activeStates, error: fetchErr } = await admin
    .from("task_workflow_state")
    .select("task_id, current_step_id, entered_at, current_step:workflow_steps(*)")
    .is("completed_at", null);

  if (fetchErr) return errorResponse(fetchErr.message, 500);
  if (!activeStates || activeStates.length === 0) {
    return jsonResponse({ success: true, auto_processed: 0, sla_escalated: 0 });
  }

  const autoProcessed: string[] = [];
  const slaEscalated: string[] = [];
  const errors: string[] = [];

  for (const state of activeStates as unknown as WorkflowState[]) {
    const step = state.current_step;
    if (!step) continue;

    try {
      if (step.is_automatic) {
        const { data: result, error: rpcErr } = await admin.rpc("fn_workflow_advance", {
          p_task: state.task_id,
          p_actor: null,
          p_result: "completed",
          p_note: "Auto-processed by workflow engine",
        });

        if (rpcErr) {
          errors.push(`auto:${state.task_id}: ${rpcErr.message}`);
          continue;
        }

        await processOnCompleteActions(admin, state.task_id, step.on_complete_actions);
        autoProcessed.push(state.task_id);
        continue;
      }

      if (step.sla_hours) {
        const enteredAt = new Date(state.entered_at).getTime();
        const hoursElapsed = (Date.now() - enteredAt) / 3_600_000;

        if (hoursElapsed > step.sla_hours) {
          await handleSLABreach(admin, state.task_id, step);
          slaEscalated.push(state.task_id);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${state.task_id}: ${msg}`);
    }
  }

  return jsonResponse({
    success: true,
    auto_processed: autoProcessed.length,
    sla_escalated: slaEscalated.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

async function handleSLABreach(
  admin: ReturnType<typeof getUntypedAdmin>,
  taskId: string,
  step: StepRecord,
) {
  const slaAction = step.sla_action || "notify";

  if (slaAction === "auto_approve") {
    const { error } = await admin.rpc("fn_workflow_advance", {
      p_task: taskId,
      p_actor: null,
      p_result: "approved",
      p_note: `Auto-approved: SLA breach (${step.sla_hours}h)`,
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { data: task } = await admin
    .from("tasks")
    .select("org_id, assigner_id, title")
    .eq("id", taskId)
    .single();

  if (!task || !task.assigner_id) return;

  await admin.from("notifications").insert({
    org_id: task.org_id,
    user_id: task.assigner_id,
    title: "SLA vượt thời hạn",
    body: `"${task.title}" đang ở bước "${step.name}" quá ${step.sla_hours}h`,
    type: "system" as const,
    data: { task_id: taskId },
  });
}

async function processOnCompleteActions(
  admin: ReturnType<typeof getUntypedAdmin>,
  taskId: string,
  actions: StepRecord["on_complete_actions"],
) {
  if (!actions || actions.length === 0) return;

  for (const act of actions) {
    if (act.type === "notify") {
      const { data: task } = await admin
        .from("tasks")
        .select("org_id, assignee_id, assigner_id, title")
        .eq("id", taskId)
        .single();

      if (!task) continue;
      const targetId = act.target === "assignee" ? task.assignee_id : task.assigner_id;
      if (!targetId) continue;

      await admin.from("notifications").insert({
        org_id: task.org_id,
        user_id: targetId,
        title: act.message || "Workflow update",
        body: `"${task.title}" đã chuyển bước`,
        type: "task_updated" as const,
        data: { task_id: taskId },
      });
    } else if (act.type === "set_field" && act.field && act.value !== undefined) {
      await admin.from("tasks").update({ [act.field]: act.value }).eq("id", taskId);
    }
  }
}
