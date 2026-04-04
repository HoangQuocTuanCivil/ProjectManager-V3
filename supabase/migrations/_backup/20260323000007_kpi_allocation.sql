-- Migration 007: KPI & Allocation

CREATE TABLE kpi_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  progress_weight NUMERIC(3,2) DEFAULT 0.50,
  ontime_weight NUMERIC(3,2) DEFAULT 0.30,
  volume_weight NUMERIC(3,2) DEFAULT 0.20,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id)
);

CREATE TABLE allocation_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Cấu hình mặc định',
  weight_volume NUMERIC(4,2) NOT NULL DEFAULT 0.40,
  weight_quality NUMERIC(4,2) NOT NULL DEFAULT 0.30,
  weight_difficulty NUMERIC(4,2) NOT NULL DEFAULT 0.20,
  weight_ahead NUMERIC(4,2) NOT NULL DEFAULT 0.10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_weights CHECK (ABS(weight_volume+weight_quality+weight_difficulty+weight_ahead-1.0)<0.01),
  UNIQUE(org_id, name)
);

CREATE TABLE allocation_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES allocation_configs(id),
  name TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  dept_id UUID REFERENCES departments(id),
  total_fund NUMERIC(15,0) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  mode allocation_mode NOT NULL DEFAULT 'per_project',
  status allocation_status NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link tasks.allocation_id -> allocation_periods
ALTER TABLE tasks ADD CONSTRAINT fk_task_alloc FOREIGN KEY (allocation_id) REFERENCES allocation_periods(id) ON DELETE SET NULL;

CREATE TABLE allocation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES allocation_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  mode allocation_mode NOT NULL DEFAULT 'per_project',
  avg_volume NUMERIC(5,2) DEFAULT 0,
  avg_quality NUMERIC(5,2) DEFAULT 0,
  avg_difficulty NUMERIC(5,2) DEFAULT 0,
  avg_ahead NUMERIC(5,2) DEFAULT 0,
  weighted_score NUMERIC(7,2) DEFAULT 0,
  share_percentage NUMERIC(5,4) DEFAULT 0,
  allocated_amount NUMERIC(15,0) DEFAULT 0,
  task_count INT DEFAULT 0,
  breakdown JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, user_id)
);

CREATE TABLE kpi_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  dept_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  period period_type NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tasks_assigned INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_overdue INT DEFAULT 0,
  tasks_on_time INT DEFAULT 0,
  score NUMERIC(5,2) DEFAULT 0,
  breakdown JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (user_id, period, period_start)
);

CREATE TABLE project_kpi_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period period_type NOT NULL,
  period_start DATE NOT NULL,
  tasks_total INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_overdue INT DEFAULT 0,
  total_kpi_weight INT DEFAULT 0,
  avg_volume NUMERIC(5,2) DEFAULT 0,
  avg_quality NUMERIC(5,2) DEFAULT 0,
  avg_difficulty NUMERIC(5,2) DEFAULT 0,
  avg_ahead NUMERIC(5,2) DEFAULT 0,
  kpi_score NUMERIC(5,2) DEFAULT 0,
  breakdown JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id, period, period_start)
);

CREATE TABLE global_kpi_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period period_type NOT NULL,
  period_start DATE NOT NULL,
  projects_count INT DEFAULT 0,
  tasks_total INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_overdue INT DEFAULT 0,
  avg_volume NUMERIC(5,2) DEFAULT 0,
  avg_quality NUMERIC(5,2) DEFAULT 0,
  avg_difficulty NUMERIC(5,2) DEFAULT 0,
  avg_ahead NUMERIC(5,2) DEFAULT 0,
  kpi_score NUMERIC(5,2) DEFAULT 0,
  project_breakdown JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id, period, period_start)
);
