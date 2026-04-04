-- Migration 010: Workflow Engine

CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  scope workflow_scope NOT NULL DEFAULT 'global',
  dept_id UUID REFERENCES departments(id),
  project_id UUID REFERENCES projects(id),
  task_type_filter task_type,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  version INT DEFAULT 1,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  step_type workflow_step_type NOT NULL,
  assigned_role user_role,
  assigned_custom_role UUID REFERENCES custom_roles(id),
  assigned_user_id UUID REFERENCES users(id),
  is_automatic BOOLEAN DEFAULT FALSE,
  transition_condition JSONB DEFAULT '{}',
  sla_hours INT,
  sla_action TEXT,
  on_complete_actions JSONB DEFAULT '[]',
  color TEXT,
  sort_order INT DEFAULT 0,
  UNIQUE(template_id, step_order)
);

CREATE TABLE workflow_transitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  from_step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  to_step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  condition_type TEXT DEFAULT 'always',
  condition_expr JSONB DEFAULT '{}',
  label TEXT,
  UNIQUE(from_step_id, to_step_id)
);

CREATE TABLE task_workflow_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE UNIQUE,
  template_id UUID NOT NULL REFERENCES workflow_templates(id),
  current_step_id UUID NOT NULL REFERENCES workflow_steps(id),
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  result TEXT,
  note TEXT
);

CREATE TABLE workflow_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow_steps(id),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES users(id),
  note TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
