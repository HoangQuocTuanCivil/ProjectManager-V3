-- Migration 004: Goals / OKR & Milestones

CREATE TABLE goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_goal_id  UUID REFERENCES goals(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  goal_type       goal_type NOT NULL DEFAULT 'team',
  status          goal_status NOT NULL DEFAULT 'on_track',
  owner_id        UUID REFERENCES users(id),
  dept_id         UUID REFERENCES departments(id),
  period_label    TEXT,
  start_date      DATE,
  due_date        DATE,
  progress        NUMERIC(5,2) DEFAULT 0,
  progress_source TEXT DEFAULT 'manual',
  is_public       BOOLEAN DEFAULT TRUE,
  color           TEXT DEFAULT '#6366f1',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE goal_targets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  target_type     target_type NOT NULL DEFAULT 'number',
  start_value     NUMERIC DEFAULT 0,
  current_value   NUMERIC DEFAULT 0,
  target_value    NUMERIC NOT NULL,
  unit            TEXT,
  is_completed    BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE goal_projects (
  goal_id     UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, project_id)
);

CREATE TABLE milestones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    DATE NOT NULL,
  status      milestone_status DEFAULT 'upcoming',
  reached_at  TIMESTAMPTZ,
  goal_id     UUID REFERENCES goals(id) ON DELETE SET NULL,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
