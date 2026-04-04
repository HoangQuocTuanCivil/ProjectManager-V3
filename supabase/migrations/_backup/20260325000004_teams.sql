-- Migration: Teams (Nhóm) — Thêm tầng nhóm vào quy trình giao việc
-- Lãnh đạo -> Phòng ban -> Nhóm -> Thành viên

-- BẢNG TEAMS
CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dept_id     UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT,
  description TEXT,
  leader_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dept_id, name)
);

-- THÊM team_id VÀO USERS VÀ TASKS
ALTER TABLE users ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- INDEXES
CREATE INDEX idx_teams_dept_id ON teams(dept_id);
CREATE INDEX idx_teams_leader_id ON teams(leader_id);
CREATE INDEX idx_teams_org_id ON teams(org_id);
CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_tasks_team_id ON tasks(team_id);

-- RLS CHO TEAMS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_read" ON teams;
CREATE POLICY "teams_read" ON teams FOR SELECT
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "teams_insert" ON teams;
CREATE POLICY "teams_insert" ON teams FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin','leader','head'));

DROP POLICY IF EXISTS "teams_update" ON teams;
CREATE POLICY "teams_update" ON teams FOR UPDATE
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin','leader','head'));

DROP POLICY IF EXISTS "teams_delete" ON teams;
CREATE POLICY "teams_delete" ON teams FOR DELETE
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin','leader','head'));

-- CẬP NHẬT RLS TASKS CHO TEAM LEADER
DROP POLICY IF EXISTS "t_staff_r" ON tasks;
DROP POLICY IF EXISTS "t_staff_u" ON tasks;

DROP POLICY IF EXISTS "t_staff_r" ON tasks;
CREATE POLICY "t_staff_r" ON tasks FOR SELECT USING (
  org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) = 'staff'
  AND (
    assignee_id = auth.uid()
    OR team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "t_staff_u" ON tasks;
CREATE POLICY "t_staff_u" ON tasks FOR UPDATE USING (
  org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) = 'staff'
  AND (
    assignee_id = auth.uid()
    OR team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "t_staff_team_leader_insert" ON tasks;
CREATE POLICY "t_staff_team_leader_insert" ON tasks FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'staff'
    AND EXISTS(SELECT 1 FROM teams WHERE leader_id = auth.uid() AND is_active = TRUE)
  );
