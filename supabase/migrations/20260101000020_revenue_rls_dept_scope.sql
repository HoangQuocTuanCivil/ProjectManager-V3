-- ============================================================================
-- REVENUE RLS: Dept-scoped cho head/team_leader/staff
-- Admin/leader/director: toàn quyền trong org.
-- Head/team_leader/staff: chỉ modify records thuộc dept mình hoặc do mình tạo.
-- ============================================================================

-- ─── revenue_entries ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS re_m ON revenue_entries;

CREATE POLICY re_manage_elevated ON revenue_entries FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'leader', 'director')
  );

CREATE POLICY re_manage_dept ON revenue_entries FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('head', 'team_leader', 'staff')
    AND (
      dept_id = public.user_dept_id()
      OR created_by = auth.uid()
    )
  );

-- ─── internal_revenue ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS ir_m ON internal_revenue;

CREATE POLICY ir_manage_elevated ON internal_revenue FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'leader', 'director')
  );

CREATE POLICY ir_manage_dept ON internal_revenue FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('head', 'team_leader', 'staff')
    AND (
      dept_id = public.user_dept_id()
      OR created_by = auth.uid()
    )
  );

-- ─── cost_entries ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ce_m ON cost_entries;

CREATE POLICY ce_manage_elevated ON cost_entries FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'leader', 'director')
  );

CREATE POLICY ce_manage_dept ON cost_entries FOR ALL
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('head', 'team_leader', 'staff')
    AND (
      dept_id = public.user_dept_id()
      OR created_by = auth.uid()
    )
  );

SELECT '020_revenue_rls_dept_scope: done' AS status;
