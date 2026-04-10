import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";
import { hasMinRole } from "@/lib/utils/permissions";
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
    .single();

  if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);

  return jsonResponse(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const body = await req.json();
  const supabase = await getServerSupabase();

  // Remove protected fields
  delete body.id;
  delete body.org_id;
  delete body.created_at;

  // Only assignee or admin can update progress
  if (body.progress !== undefined) {
    const { data: task } = await supabase.from("tasks").select("assignee_id").eq("id", params.id).single();
    if (task && profile.role !== 'admin' && task.assignee_id !== profile.id) {
      return errorResponse("Chỉ người được giao hoặc Admin mới có thể cập nhật tiến độ", 403);
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(body)
    .eq("id", params.id)
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
    .select("assignee_id")
    .eq("id", params.id)
    .single();

  if (!task) return errorResponse("Không tìm thấy công việc", 404);

  // head trở lên: xóa bất kỳ; dưới head: chỉ xóa task được giao cho mình
  if (!hasMinRole(role, "head") && task.assignee_id !== profile.id) {
    return errorResponse("Không có quyền xóa công việc này", 403);
  }

  const now = new Date().toISOString();

  const [taskResult, wfResult] = await Promise.all([
    supabase
      .from("tasks")
      .update({ status: "cancelled", deleted_at: now })
      .eq("id", params.id),
    supabase
      .from("task_workflow_state")
      .update({ completed_at: now, result: "cancelled" })
      .eq("task_id", params.id)
      .is("completed_at", null),
  ]);

  if (taskResult.error) return errorResponse(taskResult.error.message, 500);

  return jsonResponse({ success: true });
}
