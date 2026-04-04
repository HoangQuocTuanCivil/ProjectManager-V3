-- Migration 002: Core Tables (organizations, departments, users)

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  domain      TEXT UNIQUE,
  logo_url    TEXT,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE departments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  description   TEXT,
  head_user_id  UUID,
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, code)
);

CREATE TABLE users (
  id                  UUID PRIMARY KEY,
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dept_id             UUID REFERENCES departments(id) ON DELETE SET NULL,
  full_name           TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  phone               TEXT,
  avatar_url          TEXT,
  role                user_role NOT NULL DEFAULT 'staff',
  job_title           TEXT,
  is_active           BOOLEAN DEFAULT TRUE,
  custom_role_id      UUID,
  invited_by          UUID,
  invited_at          TIMESTAMPTZ,
  activated_at        TIMESTAMPTZ,
  last_login          TIMESTAMPTZ,
  login_count         INT DEFAULT 0,
  failed_login_count  INT DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  settings            JSONB DEFAULT '{"notifications_email":true,"notifications_push":true,"language":"vi","theme":"system"}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Deferred FK constraints (circular references)
ALTER TABLE departments ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_user_invited FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;
