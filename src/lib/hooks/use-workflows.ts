
// use-workflows.ts - Workflow CRUD + advance hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { WorkflowTemplate, WorkflowStep } from "@/lib/types";
import type { TablesInsert, TablesUpdate } from "@/lib/types/database";

const supabase = createClient();

export const workflowKeys = {
  all: ["workflows"] as const,
  list: () => [...workflowKeys.all, "list"] as const,
  detail: (id: string) => [...workflowKeys.all, id] as const,
  pending: () => [...workflowKeys.all, "pending"] as const,
};

export function useWorkflows() {
  return useQuery({
    queryKey: workflowKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_templates")
        .select("*, steps:workflow_steps(*, transitions_out:workflow_transitions!workflow_transitions_from_step_id_fkey(*))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (WorkflowTemplate & { steps: WorkflowStep[] })[];
    },
    staleTime: 60_000,
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: workflowKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_templates")
        .select("*, steps:workflow_steps(*), transitions:workflow_transitions(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as WorkflowTemplate;
    },
    enabled: !!id,
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: workflowKeys.pending(),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase.from("users").select("role, dept_id").eq("id", user.id).single();
      if (!profile) return [];

      // Get tasks in workflow states where current step needs current user's role
      const { data, error } = await supabase
        .from("task_workflow_state")
        .select(`
          *,
          task:tasks(id, title, assignee_id, assigner_id, status, project:projects(code, name), assignee:users!tasks_assignee_id_fkey(full_name)),
          current_step:workflow_steps(name, step_type, assigned_role),
          template:workflow_templates(name)
        `)
        .is("completed_at", null)
        .order("entered_at", { ascending: true });

      if (error) throw error;

      // Filter by role
      return (data || []).filter((s) => {
        if (!s.current_step?.assigned_role) return false;
        if (profile.role === "admin" || profile.role === "leader") return true;
        return s.current_step.assigned_role === profile.role;
      });
    },
    staleTime: 15_000,
  });
}

export function useAdvanceWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, result, note }: { taskId: string; result: string; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("fn_workflow_advance", {
        p_task: taskId,
        p_actor: user!.id,
        p_result: result,
        p_note: note || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.pending() });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkflowTemplate> & { steps?: Partial<WorkflowStep>[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();

      const { steps, ...template } = input;
      const { data: wf, error: wfErr } = await supabase
        .from("workflow_templates")
        .insert({ ...template, org_id: profile!.org_id, created_by: user!.id } as TablesInsert<'workflow_templates'>)
        .select()
        .single();
      if (wfErr) throw wfErr;

      if (steps?.length) {
        const stepInserts = steps.map((s, i) => ({ ...s, template_id: wf.id, step_order: i + 1 }));
        const { data: stepsData, error: stepsErr } = await supabase
          .from("workflow_steps")
          .insert(stepInserts as TablesInsert<'workflow_steps'>[])
          .select();
        if (stepsErr) throw stepsErr;

        // Auto-create linear transitions
        if (stepsData && stepsData.length > 1) {
          const transitions: TablesInsert<'workflow_transitions'>[] = stepsData.slice(0, -1).map((s, i) => ({
            template_id: wf.id,
            from_step_id: s.id,
            to_step_id: stepsData[i + 1].id,
            condition_type: "always",
            label: "→",
          }));

          // Add rejection transitions: review→execute, approve→review (loop back)
          const reviewStep = stepsData.find((s) => s.step_type === "review");
          const executeStep = stepsData.find((s) => s.step_type === "execute");
          const approveStep = stepsData.find((s) => s.step_type === "approve");
          if (reviewStep && executeStep) {
            transitions.push({
              template_id: wf.id,
              from_step_id: reviewStep.id,
              to_step_id: executeStep.id,
              condition_type: "if_rejected",
              label: "Yêu cầu sửa",
            });
          }
          if (approveStep && reviewStep) {
            transitions.push({
              template_id: wf.id,
              from_step_id: approveStep.id,
              to_step_id: reviewStep.id,
              condition_type: "if_rejected",
              label: "Từ chối",
            });
          }

          await supabase.from("workflow_transitions").insert(transitions);
        }
      }

      return wf;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.list() }),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, steps, ...updates }: { id: string; steps?: Partial<WorkflowStep>[] } & TablesUpdate<'workflow_templates'>) => {
      // Update template
      const { error: wfErr } = await supabase.from("workflow_templates").update(updates).eq("id", id);
      if (wfErr) throw wfErr;

      // If steps provided, rebuild them
      if (steps) {
        // Delete old steps and transitions
        await supabase.from("workflow_transitions").delete().eq("template_id", id);
        await supabase.from("workflow_steps").delete().eq("template_id", id);

        // Insert new steps
        if (steps.length > 0) {
          const stepInserts = steps.map((s, i) => ({ ...s, template_id: id, step_order: i + 1 }));
          const { data: stepsData, error: stepsErr } = await supabase
            .from("workflow_steps")
            .insert(stepInserts as TablesInsert<'workflow_steps'>[])
            .select();
          if (stepsErr) throw stepsErr;

          // Auto-create linear transitions
          if (stepsData && stepsData.length > 1) {
            const transitions: TablesInsert<'workflow_transitions'>[] = stepsData.slice(0, -1).map((s, i) => ({
              template_id: id,
              from_step_id: s.id,
              to_step_id: stepsData[i + 1].id,
              condition_type: "always",
              label: "→",
            }));

            // Add rejection transitions
            const reviewStep = stepsData.find((s) => s.step_type === "review");
            const executeStep = stepsData.find((s) => s.step_type === "execute");
            const approveStep = stepsData.find((s) => s.step_type === "approve");
            if (reviewStep && executeStep) {
              transitions.push({ template_id: id, from_step_id: reviewStep.id, to_step_id: executeStep.id, condition_type: "if_rejected", label: "Yêu cầu sửa" });
            }
            if (approveStep && reviewStep) {
              transitions.push({ template_id: id, from_step_id: approveStep.id, to_step_id: reviewStep.id, condition_type: "if_rejected", label: "Từ chối" });
            }

            await supabase.from("workflow_transitions").insert(transitions);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.list() });
      qc.invalidateQueries({ queryKey: workflowKeys.all });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete transitions, steps, then template
      await supabase.from("workflow_transitions").delete().eq("template_id", id);
      await supabase.from("workflow_steps").delete().eq("template_id", id);
      const { error } = await supabase.from("workflow_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.list() }),
  });
}

export function useToggleWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("workflow_templates").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.list() }),
  });
}
