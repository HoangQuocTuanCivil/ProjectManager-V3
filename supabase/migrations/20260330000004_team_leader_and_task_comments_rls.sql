-- Migration: Thêm role team_leader + Cập nhật RLS task_comments

-- 1. Thêm role 'team_leader' vào enum user_role
-- Trưởng nhóm giờ là vai trò mặc định (level 2)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'team_leader' AFTER 'head';

-- 2. Cập nhật RLS policies cho task_comments
-- Xóa tất cả policy cũ (tránh trùng tên giữa các migration)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'task_comments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_comments', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: Thành viên cùng tổ chức có thể đọc comments
DROP POLICY IF EXISTS "tc_select" ON task_comments;
CREATE POLICY "tc_select" ON task_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()
  ));

-- INSERT: User cùng org có thể thêm comment (user_id phải là chính mình)
DROP POLICY IF EXISTS "tc_insert" ON task_comments;
CREATE POLICY "tc_insert" ON task_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()
    )
  );

-- UPDATE: Chỉ sửa comment của mình
DROP POLICY IF EXISTS "tc_update" ON task_comments;
CREATE POLICY "tc_update" ON task_comments FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: Xóa comment của mình, admin/leader xóa bất kỳ
DROP POLICY IF EXISTS "tc_delete" ON task_comments;
CREATE POLICY "tc_delete" ON task_comments FOR DELETE
  USING (user_id = auth.uid() OR auth.user_role() IN ('admin', 'leader'));
