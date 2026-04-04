import { createClient } from './client';

/**
 * Retrieves the current authenticated user's auth identity and profile data
 * (id, org_id, dept_id, team_id, role, full_name) from the browser Supabase client.
 * Throws if not authenticated or profile is missing.
 */
export async function getCurrentUserProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('NOT_AUTHENTICATED');

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id, dept_id, team_id, role, full_name')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('PROFILE_NOT_FOUND');

  return { authUser: user, profile };
}
