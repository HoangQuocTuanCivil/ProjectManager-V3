import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, getServerSupabase, jsonResponse, errorResponse, requireMinRole, parsePagination } from "@/lib/api/helpers";
import { hasMinRole } from "@/lib/utils/permissions";
import { createTaskSchema } from "@/features/tasks/schemas/task.schema";
import type { UserRole } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const { from, to, page, per_page } = parsePagination(searchParams);

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assignee:users!tasks_assignee_id_fkey(id, full_name, avatar_url, role),
      assigner:users!tasks_assigner_id_fkey(id, full_name),
      project:projects(id, code, name),
      department:departments(id, name, code)
    `, { count: "exact" })
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .range(from, to);

  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const project_id = searchParams.get("project_id");
  const assignee_id = searchParams.get("assignee_id");
  const search = searchParams.get("search");

  if (status && status !== "all") query = query.eq("status", status as any);
  if (priority && priority !== "all") query = query.eq("priority", priority as any);
  if (project_id && project_id !== "all") query = query.eq("project_id", project_id);
  if (assignee_id && assignee_id !== "all") query = query.eq("assignee_id", assignee_id);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();
  const role = profile.role as UserRole;

  const roleErr = requireMinRole(profile, "team_leader");
  if (roleErr) return errorResponse(roleErr, 403);

  let creatorTeamIds: string[] = [];

  if (role === "team_leader") {
    const { data: ledTeams } = await (admin as any)
      .from("teams")
      .select("id")
      .eq("leader_id", user.id)
      .eq("is_active", true) as { data: { id: string }[] | null };
    creatorTeamIds = ledTeams?.map((t) => t.id) ?? [];
  }

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return errorResponse(msg, 422);
  }

  if (parsed.data.assignee_id) {
    const { data: assignee, error: lookupErr } = await admin
      .from("users")
      .select("id, org_id, dept_id, team_id, is_active")
      .eq("id", parsed.data.assignee_id)
      .single() as { data: { id: string; org_id: string; dept_id: string | null; team_id: string | null; is_active: boolean } | null; error: any };

    if (lookupErr || !assignee) {
      return errorResponse("Người được giao việc không tồn tại", 400);
    }
    if (!assignee.is_active) {
      return errorResponse("Người được giao việc đã bị vô hiệu hóa", 400);
    }
    if (assignee.org_id !== profile.org_id) {
      return errorResponse("Người được giao việc không thuộc tổ chức này", 403);
    }

    if (role === "head") {
      if (assignee.dept_id !== profile.dept_id) {
        return errorResponse("Trưởng phòng chỉ được giao việc cho nhân viên cùng phòng ban", 403);
      }
    } else if (role === "team_leader") {
      if (!assignee.team_id || !creatorTeamIds.includes(assignee.team_id)) {
        return errorResponse("Trưởng nhóm chỉ được giao việc cho thành viên trong nhóm", 403);
      }
    }
  }

  const { template_id, ...taskData } = parsed.data;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...taskData,
      org_id: profile.org_id,
      dept_id: taskData.dept_id ?? profile.dept_id,
      assigner_id: user.id,
    })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data, 201);
}
