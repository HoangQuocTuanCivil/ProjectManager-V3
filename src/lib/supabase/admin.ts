import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createAdminClient() {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Client không typed — dùng cho bảng/view Phase 2 chưa có trong Database type
// (allocation_cycle_config, salary_records, salary_deductions, project_dept_factors,
//  v_dept_fund_summary, v_employee_bonus, v_contract_profitloss)
// Sẽ loại bỏ khi regenerate Supabase types sau khi apply migrations.
export function createUntypedAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
