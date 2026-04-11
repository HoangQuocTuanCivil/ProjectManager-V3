import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Xóa toàn bộ dữ liệu phụ thuộc trước khi xóa user khỏi bảng users.
 * Các bảng có ON DELETE CASCADE (notifications, sessions, kpi_records,
 * project_kpi_summary, global_kpi_summary) được DB tự xử lý.
 */
export async function deleteUserDependencies(
  admin: SupabaseClient,
  targetId: string,
  currentUserId: string,
) {
  const t = (table: string) => admin.from(table as any);

  await Promise.all([
    // Nullable FK → set null
    admin.from("goals").update({ owner_id: null }).eq("owner_id", targetId),
    admin.from("departments").update({ head_user_id: null }).eq("head_user_id", targetId),
    admin.from("centers").update({ director_id: null }).eq("director_id", targetId),
    admin.from("teams").update({ leader_id: null }).eq("leader_id", targetId),
    admin.from("projects").update({ manager_id: null }).eq("manager_id", targetId),
    admin.from("tasks").update({ kpi_evaluated_by: null }).eq("kpi_evaluated_by", targetId),
    admin.from("tasks").update({ assigner_id: currentUserId }).eq("assigner_id", targetId),
    admin.from("workflow_steps").update({ assigned_user_id: null }).eq("assigned_user_id", targetId),
    admin.from("audit_logs").update({ user_id: null }).eq("user_id", targetId),
    admin.from("allocation_periods").update({ approved_by: null }).eq("approved_by", targetId),
    t("task_proposals").update({ approver_id: null }).eq("approver_id", targetId),
    t("checklist_items").update({ assignee_id: null }).eq("assignee_id", targetId),
    t("task_workflow_state").update({ completed_by: null }).eq("completed_by", targetId),
    t("workflow_history").update({ actor_id: null }).eq("actor_id", targetId),
    t("workflow_templates").update({ created_by: null }).eq("created_by", targetId),
    t("task_templates").update({ created_by: null }).eq("created_by", targetId),
    t("project_templates").update({ created_by: null }).eq("created_by", targetId),
    t("intake_forms").update({ auto_assign_to: null }).eq("auto_assign_to", targetId),
    t("intake_forms").update({ created_by: null }).eq("created_by", targetId),
    t("form_submissions").update({ submitted_by: null }).eq("submitted_by", targetId),
    t("automation_rules").update({ created_by: null }).eq("created_by", targetId),
    t("org_settings").update({ updated_by: null }).eq("updated_by", targetId),

    // NOT NULL FK → reassign to current user
    t("contracts").update({ created_by: currentUserId }).eq("created_by", targetId),
    t("contract_addendums").update({ created_by: currentUserId }).eq("created_by", targetId),
    t("revenue_entries").update({ created_by: currentUserId }).eq("created_by", targetId),
    t("revenue_adjustments").update({ adjusted_by: currentUserId }).eq("adjusted_by", targetId),
    t("cost_entries").update({ created_by: currentUserId }).eq("created_by", targetId),
    t("dept_budget_allocations").update({ created_by: currentUserId }).eq("created_by", targetId),
    t("acceptance_rounds").update({ created_by: currentUserId }).eq("created_by", targetId),
    t("status_updates").update({ author_id: currentUserId }).eq("author_id", targetId),
    t("salary_records").update({ created_by: currentUserId }).eq("created_by", targetId),

    // Soft-delete user-owned tasks
    (admin.from("tasks") as any)
      .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
      .eq("assignee_id", targetId)
      .is("deleted_at", null),
    t("salary_deductions").delete().eq("user_id", targetId),
    t("salary_records").delete().eq("user_id", targetId),
    admin.from("allocation_results").delete().eq("user_id", targetId),
    admin.from("user_invitations").delete().eq("invited_by", targetId),
    admin.from("dashboards").delete().eq("owner_id", targetId),
    admin.from("task_proposals").delete().eq("proposed_by", targetId),
    admin.from("task_comments").delete().eq("user_id", targetId),
    admin.from("task_status_logs").delete().eq("user_id", targetId),
    admin.from("task_scores").delete().eq("scored_by", targetId),
    admin.from("task_attachments").delete().eq("uploaded_by", targetId),
    admin.from("time_entries").delete().eq("user_id", targetId),
  ]);
}

/**
 * Soft-delete dữ liệu phụ thuộc khi xóa project.
 * Đặt deleted_at cho contracts và tasks liên quan.
 */
export async function softDeleteProjectDependencies(
  admin: SupabaseClient,
  projectId: string,
) {
  const now = new Date().toISOString();

  await (admin.from("contracts") as any)
    .update({ deleted_at: now })
    .eq("project_id", projectId).is("deleted_at", null);

  await (admin.from("tasks") as any)
    .update({ deleted_at: now, status: "cancelled" })
    .eq("project_id", projectId).is("deleted_at", null);

  await (admin.from("revenue_entries") as any)
    .update({ deleted_at: now, status: "cancelled" })
    .eq("project_id", projectId).is("deleted_at", null);

  await (admin.from("dept_budget_allocations") as any)
    .update({ deleted_at: now })
    .eq("project_id", projectId);

  await (admin.from("allocation_periods") as any)
    .update({ deleted_at: now })
    .eq("project_id", projectId);
}
