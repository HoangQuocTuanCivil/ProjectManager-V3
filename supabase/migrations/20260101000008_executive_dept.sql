-- ============================================================================
-- BAN DIEU HANH: Phòng ban đặc biệt có quyền Lãnh đạo
-- Nhân sự thuộc phòng ban is_executive = true sẽ thấy toàn bộ trung tâm
-- ============================================================================

-- ─── 1. Thêm cột is_executive vào departments ────────────────────────────────
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_executive BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN departments.is_executive IS 'Phòng ban đặc biệt: nhân sự thuộc PB này có quyền xem toàn bộ trung tâm (Ban điều hành)';

-- ─── 2. Helper function: kiểm tra user thuộc PB executive ────────────────────
CREATE OR REPLACE FUNCTION public.user_is_executive() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT d.is_executive FROM departments d
     JOIN users u ON u.dept_id = d.id
     WHERE u.id = auth.uid()),
    false
  );
$$;

-- ─── 3. Cập nhật RLS dept_budget_allocations: thêm executive ─────────────────
-- Drop policy cũ rồi tạo lại với điều kiện mới
DROP POLICY IF EXISTS "dba_r" ON dept_budget_allocations;
CREATE POLICY "dba_r" ON dept_budget_allocations FOR SELECT
  USING (
    org_id = public.user_org_id()
    AND (
      public.user_role() IN ('admin', 'leader', 'director')
      OR public.user_is_executive()
      OR dept_id = public.user_dept_id()
    )
  );

-- ─── 4. Seed: Ban điều hành ──────────────────────────────────────────────────
INSERT INTO departments (id, org_id, name, code, description, sort_order, is_executive)
VALUES (
  'de000000-0000-0000-0000-000000000099',
  'a2a00000-0000-0000-0000-000000000001',
  'Ban điều hành',
  'BDH',
  'Ban lãnh đạo - có quyền xem toàn bộ trung tâm',
  0,
  true
) ON CONFLICT (id) DO UPDATE SET is_executive = true;
