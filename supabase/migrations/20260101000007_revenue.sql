-- ============================================================================
-- A2Z WORKHUB — DOANH THU & CHI PHÍ (Revenue & Costs)
-- ============================================================================

-- ─── ENUMS ───────────────────────────────────────────────────────────────────
CREATE TYPE revenue_dimension AS ENUM ('project', 'contract', 'period', 'product_service');
CREATE TYPE recognition_method AS ENUM ('acceptance', 'completion_rate', 'time_based');
CREATE TYPE revenue_source AS ENUM ('billing_milestone', 'acceptance', 'manual');
CREATE TYPE internal_revenue_status AS ENUM ('pending', 'approved', 'recorded');
CREATE TYPE cost_category AS ENUM ('personnel', 'survey', 'procurement', 'overhead');

-- ─── DOANH THU CÔNG TY ──────────────────────────────────────────────────────

CREATE TABLE revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  dept_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  dimension revenue_dimension NOT NULL DEFAULT 'project',
  method recognition_method NOT NULL DEFAULT 'acceptance',
  source revenue_source NOT NULL DEFAULT 'manual',
  source_id UUID,
  amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DOANH THU NỘI BỘ ───────────────────────────────────────────────────────

CREATE TABLE internal_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  dept_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  status internal_revenue_status NOT NULL DEFAULT 'pending',
  period_start DATE,
  period_end DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CHI PHÍ ─────────────────────────────────────────────────────────────────

CREATE TABLE cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  dept_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  category cost_category NOT NULL DEFAULT 'overhead',
  description TEXT NOT NULL,
  amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  budget_amount NUMERIC(15,0) DEFAULT 0,
  period_start DATE,
  period_end DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_revenue_org ON revenue_entries(org_id, dimension, created_at DESC);
CREATE INDEX idx_revenue_project ON revenue_entries(project_id, created_at DESC);
CREATE INDEX idx_revenue_contract ON revenue_entries(contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX idx_revenue_dept ON revenue_entries(dept_id) WHERE dept_id IS NOT NULL;

CREATE INDEX idx_intrev_org ON internal_revenue(org_id, status, created_at DESC);
CREATE INDEX idx_intrev_dept ON internal_revenue(dept_id, status);
CREATE INDEX idx_intrev_project ON internal_revenue(project_id) WHERE project_id IS NOT NULL;

CREATE INDEX idx_cost_org ON cost_entries(org_id, category, created_at DESC);
CREATE INDEX idx_cost_project ON cost_entries(project_id, created_at DESC);
CREATE INDEX idx_cost_dept ON cost_entries(dept_id) WHERE dept_id IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_entries ENABLE ROW LEVEL SECURITY;

-- Revenue Entries
CREATE POLICY "re_r" ON revenue_entries FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "re_m" ON revenue_entries FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- Internal Revenue
CREATE POLICY "ir_r" ON internal_revenue FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "ir_m" ON internal_revenue FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- Cost Entries
CREATE POLICY "ce_r" ON cost_entries FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "ce_m" ON cost_entries FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

SELECT '✅ 007_revenue: Doanh thu & Chi phí đã tạo xong' AS status;
