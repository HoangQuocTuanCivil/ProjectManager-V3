-- Fix: users_director policy causes infinite recursion because it subqueries
-- the users table inside its own RLS policy.
-- Solution: create auth.user_center_id() SECURITY DEFINER function (bypasses RLS).

CREATE OR REPLACE FUNCTION auth.user_center_id() RETURNS UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT center_id FROM users WHERE id = auth.uid();
$$;

-- Recreate users_director policy using the new function instead of direct subquery
DROP POLICY IF EXISTS "users_director" ON users;
CREATE POLICY "users_director" ON users FOR ALL
  USING (
    auth.user_role() = 'director'
    AND org_id = auth.user_org_id()
    AND (
      dept_id IN (SELECT id FROM departments WHERE center_id = auth.user_center_id())
      OR center_id = auth.user_center_id()
      OR id = auth.uid()
    )
  );

-- Also fix other director policies that reference users table directly

DROP POLICY IF EXISTS "proj_director" ON projects;
CREATE POLICY "proj_director" ON projects FOR ALL
  USING (
    auth.user_role() = 'director'
    AND org_id = auth.user_org_id()
    AND dept_id IN (SELECT id FROM departments WHERE center_id = auth.user_center_id())
  );

DROP POLICY IF EXISTS "dept_director" ON departments;
CREATE POLICY "dept_director" ON departments FOR ALL
  USING (
    auth.user_role() = 'director'
    AND org_id = auth.user_org_id()
    AND center_id = auth.user_center_id()
  );
