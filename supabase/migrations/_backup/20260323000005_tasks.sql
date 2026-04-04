-- Migration 005: Tasks (core) with KPI E/A

CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dept_id           UUID REFERENCES departments(id) ON DELETE SET NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  assignee_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  assigner_id       UUID NOT NULL REFERENCES users(id),
  status            task_status NOT NULL DEFAULT 'pending',
  priority          task_priority NOT NULL DEFAULT 'medium',
  task_type         task_type NOT NULL DEFAULT 'task',
  kpi_weight        INT NOT NULL DEFAULT 5 CHECK (kpi_weight BETWEEN 1 AND 10),
  progress          INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  -- KPI Expected (TP nhập khi giao)
  expect_volume     INT DEFAULT 100 CHECK (expect_volume BETWEEN 0 AND 100),
  expect_quality    INT DEFAULT 80  CHECK (expect_quality BETWEEN 0 AND 100),
  expect_difficulty INT DEFAULT 50  CHECK (expect_difficulty BETWEEN 0 AND 100),
  expect_ahead      INT DEFAULT 50  CHECK (expect_ahead BETWEEN 0 AND 100),
  -- KPI Actual (hệ thống + TP chấm khi nghiệm thu)
  actual_volume     INT DEFAULT 0 CHECK (actual_volume BETWEEN 0 AND 100),
  actual_quality    INT DEFAULT 0 CHECK (actual_quality BETWEEN 0 AND 100),
  actual_difficulty INT DEFAULT 0 CHECK (actual_difficulty BETWEEN 0 AND 100),
  actual_ahead      INT DEFAULT 0 CHECK (actual_ahead BETWEEN 0 AND 100),
  -- Auto-calculated scores
  expect_score      NUMERIC(5,2) GENERATED ALWAYS AS (expect_volume*0.40+expect_quality*0.30+expect_difficulty*0.20+expect_ahead*0.10) STORED,
  actual_score      NUMERIC(5,2) GENERATED ALWAYS AS (actual_volume*0.40+actual_quality*0.30+actual_difficulty*0.20+actual_ahead*0.10) STORED,
  kpi_variance      NUMERIC(5,2) GENERATED ALWAYS AS ((actual_volume*0.40+actual_quality*0.30+actual_difficulty*0.20+actual_ahead*0.10)-(expect_volume*0.40+expect_quality*0.30+expect_difficulty*0.20+expect_ahead*0.10)) STORED,
  -- KPI evaluation
  kpi_evaluated_by  UUID REFERENCES users(id),
  kpi_evaluated_at  TIMESTAMPTZ,
  kpi_note          TEXT,
  -- Dates
  start_date        DATE,
  deadline          DATE,
  completed_at      TIMESTAMPTZ,
  -- Hierarchy & links
  parent_task_id    UUID REFERENCES tasks(id) ON DELETE SET NULL,
  milestone_id      UUID REFERENCES milestones(id) ON DELETE SET NULL,
  goal_id           UUID REFERENCES goals(id) ON DELETE SET NULL,
  allocation_id     UUID,
  template_id       UUID,
  -- Time tracking
  estimate_hours    NUMERIC(6,1),
  actual_hours      NUMERIC(6,1),
  -- Health & recurrence
  health            health_score DEFAULT 'gray',
  is_milestone      BOOLEAN DEFAULT FALSE,
  is_recurring      BOOLEAN DEFAULT FALSE,
  recurrence        recurrence_type,
  recurrence_end    DATE,
  -- Metadata
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
