-- Migration: Bảng task_proposals — Đề xuất giao việc

CREATE TABLE IF NOT EXISTS task_proposals (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proposed_by   UUID NOT NULL REFERENCES users(id),
  approver_id   UUID NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  description   TEXT,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  dept_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id       UUID REFERENCES teams(id) ON DELETE SET NULL,
  priority      task_priority DEFAULT 'medium',
  task_type     task_type DEFAULT 'task',
  kpi_weight    INT DEFAULT 5 CHECK (kpi_weight BETWEEN 1 AND 10),
  start_date    DATE,
  deadline      DATE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason TEXT,
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_proposals_org ON task_proposals(org_id);
CREATE INDEX idx_proposals_proposed_by ON task_proposals(proposed_by);
CREATE INDEX idx_proposals_approver ON task_proposals(approver_id, status);
CREATE INDEX idx_proposals_status ON task_proposals(status);

-- RLS
ALTER TABLE task_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tp_select" ON task_proposals;
CREATE POLICY "tp_select" ON task_proposals FOR SELECT
  USING (org_id = auth.user_org_id());

DROP POLICY IF EXISTS "tp_insert" ON task_proposals;
CREATE POLICY "tp_insert" ON task_proposals FOR INSERT
  WITH CHECK (proposed_by = auth.uid() AND org_id = auth.user_org_id());

DROP POLICY IF EXISTS "tp_update" ON task_proposals;
CREATE POLICY "tp_update" ON task_proposals FOR UPDATE
  USING (org_id = auth.user_org_id()
    AND (proposed_by = auth.uid() OR approver_id = auth.uid()));

-- Notification types
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_proposal';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'proposal_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'proposal_rejected';
