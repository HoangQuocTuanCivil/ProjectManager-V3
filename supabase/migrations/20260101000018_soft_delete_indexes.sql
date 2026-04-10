-- ============================================================================
-- SOFT DELETE + INDEXES
-- Thêm deleted_at cho projects, contracts, tasks.
-- Thêm indexes cho các FK thường xuyên filter.
-- ============================================================================

-- ─── SOFT DELETE ────────────────────────────────────────────────────────────

ALTER TABLE projects  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial indexes: chỉ index các bản ghi chưa xóa (phần lớn query dùng)
CREATE INDEX IF NOT EXISTS idx_projects_active
  ON projects (org_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_active
  ON contracts (org_id, contract_type, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_active
  ON tasks (org_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── INDEXES BỔ SUNG ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id
  ON tasks (assignee_id)
  WHERE assignee_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_project_id
  ON contracts (project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id
  ON tasks (project_id)
  WHERE project_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_team_status
  ON tasks (team_id, status)
  WHERE team_id IS NOT NULL AND deleted_at IS NULL;

SELECT '018_soft_delete_indexes: done' AS status;
