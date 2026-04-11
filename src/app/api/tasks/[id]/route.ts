import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";
import { hasMinRole } from "@/lib/utils/permissions";
import { patchTaskSchema, KPI_EVALUATION_FIELDS, MANAGEMENT_FIELDS, ASSIGNEE_SELF_FIELDS } from "@/features/tasks/schemas/task.schema";
import type { UserRole } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assignee:users!tasks_assignee_id_fkey(*),
      assigner:users!tasks_assigner_id_fkey(*),
      project:projects(*),
      department:departments(*),
      comments:task_comments(*, user:users(*)),
      attachments:task_attachments(*),
      checklists:task_checklists(*, items:checklist_items(*)),
      dependencies:task_dependencies(*, depends_on:tasks!task_dependencies_depends_on_id_fkey(id, title, status)),
      workflow_state:task_workflow_state(*, current_step:workflow_steps(*))
    `)
    .eq("id", params.id)
    .is("deleted_at" as any, null)
    .single();

  if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);

  return jsonResponse(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const role = profile.role as UserRole;
  const supabase = await getServerSupabase();

  const { data: task } = await supabase
    .from("tasks")
    .select("assignee_id, assigner_id, dept_id, team_id, status")
    .eq("id", params.id)
    .is("deleted_at" as any, null)
    .single();

  if (!task) return errorResponse("Không tìm thấy công việc", 404);
  if (task.status === "cancelled") return errorResponse("Công việc đã bị hủy", 410);

  const isAdmin = role === "admin";
  const isManager = hasMinRole(role, "head");
  const isAssigner = task.assigner_id === profile.id;
  const isAssignee = task.assignee_id === profile.id;
  const isSupervisor = hasMinRole(role, "team_leader") && (
    isAssigner || task.dept_id === profile.dept_id || task.team_id === profile.team_id
  );

  if (!isAdmin && !isManager && !isSupervisor && !isAssigner && !isAssignee) {
    return errorResponse("Không có quyền cập nhật công việc này", 403);
  }

  const raw = await req.json();
  const parsed = patchTaskSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return errorResponse(msg, 422);
  }

  const validated = parsed.data;
  if (Object.keys(validated).length === 0) {
    return errorResponse("Không có trường hợp lệ để cập nhật", 422);
  }

  const allowed: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(validated)) {
    if (KPI_EVALUATION_FIELDS.has(field)) {
      if (isManager || isAdmin) allowed[field] = value;
      continue;
    }

    if (field === "progress") {
      if (isAssignee || isAdmin) allowed[field] = value;
      continue;
    }

    if (MANAGEMENT_FIELDS.has(field)) {
      if (isAdmin || isManager || isSupervisor || isAssigner) allowed[field] = value;
      continue;
    }

    if (ASSIGNEE_SELF_FIELDS.has(field)) {
      if (isAssignee || isAdmin || isManager || isSupervisor || isAssigner) allowed[field] = value;
      continue;
    }
  }

  if (Object.keys(allowed).length === 0) {
    return errorResponse("Không có quyền cập nhật các trường đã yêu cầu", 403);
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(allowed)
    .eq("id", params.id)
    .is("deleted_at" as any, null)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const role = profile.role as UserRole;

  const { data: task } = await supabase
    .from("tasks")
    .select("assignee_id, status")
    .eq("id", params.id)
    .is("deleted_at" as any, null)
    .single();

  if (!task) return errorResponse("Không tìm thấy công việc", 404);
  if (task.status === "cancelled") return errorResponse("Công việc đã bị hủy", 410);

  if (!hasMinRole(role, "head") && task.assignee_id !== profile.id) {
    return errorResponse("Không có quyền xóa công việc này", 403);
  }

  const now = new Date().toISOString();

  const [taskResult] = await Promise.all([
    supabase
      .from("tasks")
      .update({ status: "cancelled", deleted_at: now })
      .eq("id", params.id),
    supabase
      .from("task_workflow_state")
      .update({ completed_at: now, result: "cancelled" })
      .eq("task_id", params.id)
      .is("completed_at", null),
    supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("task_id", params.id)
      .eq("is_read", false),
  ]);

  if (taskResult.error) return errorResponse(taskResult.error.message, 500);

  return jsonResponse({ success: true });
}
