import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient, createUntypedAdmin } from "@/lib/supabase/admin";

export async function getServerSupabase() {
  return createServerSupabase();
}

export function getAdminSupabase() {
  return createAdminClient();
}

// Dùng cho bảng/view Phase 2 chưa có trong Database type definition
export function getUntypedAdmin() {
  return createUntypedAdmin();
}
