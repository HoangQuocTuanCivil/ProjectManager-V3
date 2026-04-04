-- Migration 003: Projects & Members

CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  dept_id         UUID REFERENCES departments(id),
  manager_id      UUID REFERENCES users(id),
  status          project_status DEFAULT 'active',
  budget          NUMERIC(15,0) DEFAULT 0,
  allocation_fund NUMERIC(15,0) DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  location        TEXT,
  client          TEXT,
  contract_no     TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, code)
);

CREATE TABLE project_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        project_member_role DEFAULT 'engineer',
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  is_active   BOOLEAN DEFAULT TRUE,
  UNIQUE(project_id, user_id)
);
