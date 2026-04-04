-- Director policies should be SCOPED to center, not full org.
-- Migration 000008 added director to ('admin','leader','director') which gives full org access.
-- Spec: keep ('admin','leader') for full org, add separate *_director policies scoped to center.

-- Helper: departments within director's center
-- pattern: dept_id IN (SELECT id FROM departments WHERE center_id = (SELECT center_id FROM users WHERE id = auth.uid()))

-- users_manage: revert to ('admin','leader'), add users_director scoped
DROP POLICY IF EXISTS "users_manage" ON users;
CREATE POLICY "users_manage" ON users FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader'));

DROP POLICY IF EXISTS "users_director" ON users;
CREATE POLICY "users_director" ON users FOR ALL
  USING (
    auth.user_role() = 'director'
    AND org_id = auth.user_org_id()
    AND (
      dept_id IN (SELECT id FROM departments WHERE center_id = (SELECT center_id FROM users WHERE id = auth.uid()))
      OR center_id = (SELECT center_id FROM users WHERE id = auth.uid())
      OR id = auth.uid()
    )
  );

-- proj_m: revert to ('admin','leader'), add proj_director scoped
DROP POLICY IF EXISTS "proj_m" ON projects;
CREATE POLICY "proj_m" ON projects FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader'));

DROP POLICY IF EXISTS "proj_director" ON projects;
CREATE POLICY "proj_director" ON projects FOR ALL
  USING (
    auth.user_role() = 'director'
    AND org_id = auth.user_org_id()
    AND dept_id IN (SELECT id FROM departments WHERE center_id = (SELECT center_id FROM users WHERE id = auth.uid()))
  );

-- dept_m: revert to ('admin','leader'), add dept_director scoped
DROP POLICY IF EXISTS "dept_m" ON departments;
CREATE POLICY "dept_m" ON departments FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader'));

DROP POLICY IF EXISTS "dept_director" ON departments;
CREATE POLICY "dept_director" ON departments FOR ALL
  USING (
    auth.user_role() = 'director'
    AND org_id = auth.user_org_id()
    AND center_id = (SELECT center_id FROM users WHERE id = auth.uid())
  );

-- set_m: revert to ('admin','leader'), add set_director scoped
DROP POLICY IF EXISTS "set_m" ON org_settings;
CREATE POLICY "set_m" ON org_settings FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader'));

DROP POLICY IF EXISTS "set_director" ON org_settings;
CREATE POLICY "set_director" ON org_settings FOR SELECT
  USING (
    auth.user_role() = 'director'
    AND org_id = auth.user_org_id()
  );

-- wf_m: revert to ('admin','leader'), add wf_director scoped
DROP POLICY IF EXISTS "wf_m" ON workflow_templates;
CREATE POLICY "wf_m" ON workflow_templates FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'leader'));

DROP POLICY IF EXISTS "wf_director" ON workflow_templates;
CREATE POLICY "wf_director" ON workflow_templates FOR SELECT
  USING (
    auth.user_role() = 'director'
    AND org_id = auth.user_org_id()
  );

-- audit_r: keep director in list (director xem audit toàn center) - already correct
-- No change needed, migration 000008 already has ('admin','leader','director')

-- center_manage: no director (director cannot create/delete centers) - already correct
-- Original ('admin','leader') from centers.sql, never changed
