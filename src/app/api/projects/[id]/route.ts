import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { updateProjectSchema } from "@/features/projects/schemas/project.schema";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      manager:users!projects_manager_id_fkey(*),
      department:departments(*),
      members:project_members(*, user:users(*)),
      milestones:milestones(*)
    `)
    .eq("id", params.id)
    .single();

  if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);

  return jsonResponse(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "director");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const parsed = updateProjectSchema.safeParse({ ...body, id: params.id });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return errorResponse(msg, 422);
  }

  const { id, ...updates } = parsed.data;
  const supabase = await getServerSupabase();

  // FK validation: manager_id & dept_id must reference existing records
  if (updates.manager_id || updates.dept_id) {
    const checks = await Promise.all([
      updates.manager_id
        ? supabase.from("users").select("id").eq("id", updates.manager_id).single()
        : null,
      updates.dept_id
        ? supabase.from("departments").select("id").eq("id", updates.dept_id).single()
        : null,
    ]);
    if (updates.manager_id && checks[0]?.error)
      return errorResponse("Manager không tồn tại", 400);
    if (updates.dept_id && checks[1]?.error)
      return errorResponse("Phòng ban không tồn tại", 400);
  }

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const admin = getAdminSupabase();
  const now = new Date().toISOString();

  const { error } = await (admin
    .from("projects") as any)
    .update({ deleted_at: now, status: "archived" })
    .eq("id", params.id)
    .is("deleted_at", null);
  if (error) return errorResponse(error.message, 500);

  // Check confirmed revenue before deleting
  const { count: confirmedRevCount } = await (admin
    .from("revenue_entries") as any)
    .select("id", { count: "exact", head: true })
    .eq("project_id", params.id)
    .eq("status", "confirmed")
    .is("deleted_at", null);

  if (confirmedRevCount && confirmedRevCount > 0) {
    // Rollback project soft-delete
    await (admin.from("projects") as any)
      .update({ deleted_at: null, status: "active" })
      .eq("id", params.id);
    return errorResponse(
      `Không thể xóa: dự án có ${confirmedRevCount} doanh thu đã xác nhận. Hủy doanh thu trước.`,
      409,
    );
  }

  const { data: taskIds } = await (admin
    .from("tasks") as any)
    .select("id")
    .eq("project_id", params.id)
    .is("deleted_at", null);

  await Promise.all([
    (admin.from("contracts") as any).update({ deleted_at: now }).eq("project_id", params.id).is("deleted_at", null),
    (admin.from("tasks") as any).update({ deleted_at: now, status: "cancelled" }).eq("project_id", params.id).is("deleted_at", null),
    (admin.from("revenue_entries") as any).update({ deleted_at: now, status: "cancelled" }).eq("project_id", params.id).is("deleted_at", null),
    (admin.from("allocation_periods") as any).update({ deleted_at: now }).eq("project_id", params.id).is("deleted_at", null),
    ...(taskIds && taskIds.length > 0
      ? [
          (admin.from("task_workflow_state") as any)
            .update({ completed_at: now, result: "cancelled" })
            .in("task_id", taskIds.map((t: { id: string }) => t.id))
            .is("completed_at", null),
          (admin.from("notifications") as any)
            .update({ is_read: true })
            .in("task_id", taskIds.map((t: { id: string }) => t.id))
            .eq("is_read", false),
        ]
      : []),
  ]);

  return jsonResponse({ success: true });
}
