-- Migration 009: Permissions & Custom Roles

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0
);

CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  base_role user_role NOT NULL DEFAULT 'staff',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

-- Link users.custom_role_id -> custom_roles
ALTER TABLE users ADD CONSTRAINT fk_user_custom_role FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE SET NULL;

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope TEXT DEFAULT 'all',
  PRIMARY KEY (role_id, permission_id)
);
