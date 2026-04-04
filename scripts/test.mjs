import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) { console.error('MISSING ENV VARS'); process.exit(1); }
const adminAuthClient = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = `test.user.${Date.now()}@example.com`;
  console.log('Testing create user with email:', email);
  const { data, error } = await adminAuthClient.auth.admin.createUser({
    email,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Test User' },
  });

  if (error) {
    console.error('ERROR creating auth user:', error);
  } else {
    console.log('User created:', data.user.id);
    // Cleanup
    await adminAuthClient.auth.admin.deleteUser(data.user.id);
    console.log('User deleted for cleanup.');
  }
}

main();
