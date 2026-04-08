import { NextRequest } from "next/server";
import { getAuthProfile, getAdminSupabase, getServerSupabase, jsonResponse, errorResponse, requireMinRole } from "@/lib/api/helpers";
import { hasMinRole } from "@/lib/utils/permissions";
import type { UserRole } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const admin = getAdminSupabase();

  // Base query using admin client (bypasses RLS)
  let query = admin
    .from("users")
    .select("*, department:departments!users_dept_id_fkey(id, name, code)")
    .eq("org_id", profile.org_id)
    .order("full_name");

  // Role-based filtering
  if (profile.role === "head") {
    const { data: ledTeams } = await admin
      .from("teams")
      .select("id")
      .eq("leader_id", user.id)
      .eq("is_active", true);

    const orFilters: string[] = [];
    if (profile.dept_id) {
      orFilters.push(`dept_id.eq.${profile.dept_id}`);
    }
    if (ledTeams && ledTeams.length > 0) {
      const teamIds = ledTeams.map((t: any) => t.id);
      orFilters.push(`team_id.in.(${teamIds.join(",")})`);
    }
    orFilters.push(`id.eq.${user.id}`);
    if (orFilters.length > 0) {
      query = query.or(orFilters.join(","));
    }
  } else if (profile.role === "team_leader") {
    const { data: ledTeams } = await admin
      .from("teams")
      .select("id, dept_id")
      .eq("leader_id", user.id)
      .eq("is_active", true);

    const orFilters: string[] = [`id.eq.${user.id}`];
    if (ledTeams && ledTeams.length > 0) {
      orFilters.push(`team_id.in.(${ledTeams.map((t: any) => t.id).join(",")})`);
    }
    if (profile.dept_id) {
      orFilters.push(`dept_id.eq.${profile.dept_id}`);
    }
    query = query.or(orFilters.join(","));
  } else if (profile.role === "staff") {
    query = query.eq("id", user.id);
  }

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  // Fetch team names separately
  if (data && data.length > 0) {
    const teamIds = [...new Set(data.map((u: any) => u.team_id).filter(Boolean))];
    if (teamIds.length > 0) {
      const { data: teamsData } = await admin.from("teams").select("id, name, code").in("id", teamIds);
      if (teamsData) {
        const enriched = data.map((u: any) => ({
          ...u,
          team: teamsData.find((t: any) => t.id === u.team_id) || null,
        }));
        return jsonResponse(enriched);
      }
    }
  }

  return jsonResponse(data || []);
}

export async function POST(req: NextRequest) {
  const { profile } = await getAuthProfile();
  const roleErr = requireMinRole(profile, "director");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const { email, password, full_name, role, dept_id, team_id, job_title, employee_code } = body;

  // Director: chỉ tạo user trong center mình
  if (profile!.role === "director" && dept_id) {
    const admin = getAdminSupabase();
    const { data: dept } = await admin
      .from("departments")
      .select("center_id")
      .eq("id", dept_id)
      .single() as { data: { center_id: string | null } | null };
    const directorCenterId = (profile as any).center_id;
    if (dept && dept.center_id !== directorCenterId) {
      return errorResponse("Director chỉ tạo user trong center mình quản lý", 403);
    }
  }

  if (!email || !password || !full_name) {
    return errorResponse("Email, mật khẩu và họ tên là bắt buộc", 400);
  }

  const admin = getAdminSupabase();

  // 1. Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    console.error("[createUser] Auth Error:", authError);
    return errorResponse(`[Lỗi Auth/Trigger] ${authError.message}`, 400);
  }

  // 2. Create or Update public user profile
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from("users").upsert({
    id: authData.user.id,
    org_id: profile!.org_id,
    dept_id: dept_id || null,
    team_id: team_id || null,
    full_name,
    email,
    role: role || "staff",
    job_title: job_title || null,
    employee_code: employee_code || null,
    is_active: true,
  }).select("*, department:departments!users_dept_id_fkey(id, name, code)").single();

  if (error) {
    console.error("[createUser] DB Upsert Error:", error);
    // Rollback: delete auth user if profile creation fails
    await admin.auth.admin.deleteUser(authData.user.id);
    return errorResponse(`[Lỗi DB Upsert] ${error.message}`, 500);
  }

  return jsonResponse(data, 201);
}

