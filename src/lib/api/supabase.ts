import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getServerSupabase() {
  return createServerSupabase();
}

export function getAdminSupabase() {
  return createAdminClient();
}
