import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser Client (Client Components)
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
