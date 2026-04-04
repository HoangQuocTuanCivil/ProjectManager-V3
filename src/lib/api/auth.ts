import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasMinRole } from "@/lib/utils/permissions";
import type { UserRole } from "@/lib/types";

export async function getAuthUser() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Fetches the user's profile using the admin client (bypasses RLS)
 * to avoid circular dependency with auth.user_org_id().
 */
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
