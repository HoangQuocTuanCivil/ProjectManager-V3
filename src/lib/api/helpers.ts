import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasMinRole } from "@/lib/utils/permissions";
import type { UserRole } from "@/lib/types";

export function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getAuthUser() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Admin client bypasses RLS to avoid circular dependency with auth.user_org_id()
export async function getUserProfile(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, org_id, dept_id, team_id, role, full_name, email, is_active")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data as {
    id: string;
    org_id: string;
    dept_id: string | null;
    team_id: string | null;
    role: string;
    full_name: string;
    email: string;
    is_active: boolean;
  };
}

export async function getAuthProfile() {
  const user = await getAuthUser();
  if (!user) return { user: null, profile: null };
  const profile = await getUserProfile(user.id);
  return { user, profile };
}

export function requireMinRole(profile: { role: string } | null, minRole: UserRole): string | null {
  if (!profile) return "Unauthorized";
  if (!hasMinRole(profile.role as UserRole, minRole)) return "Forbidden: insufficient permissions";
  return null;
}

export function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function getServerSupabase() {
  return createServerSupabase();
}

export function getAdminSupabase() {
  return createAdminClient();
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const per_page = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "50")));
  const from = (page - 1) * per_page;
  const to = from + per_page - 1;
  return { page, per_page, from, to };
}
