-- ============================================================================
-- A2Z WORKHUB — DOANH THU, CHI PHÍ & PHÂN BỔ
-- ============================================================================

-- ─── ENUMS ──────────────────────────────────────────────────────────────────

CREATE TYPE revenue_dimension AS ENUM ('project', 'contract', 'period', 'product_service');
CREATE TYPE recognition_method AS ENUM ('acceptance', 'completion_rate', 'time_based');
CREATE TYPE revenue_source AS ENUM ('billing_milestone', 'acceptance', 'manual');
CREATE TYPE revenue_entry_status AS ENUM ('draft', 'confirmed', 'adjusted', 'cancelled');
CREATE TYPE internal_revenue_status AS ENUM ('pending', 'approved', 'recorded');
CREATE TYPE cost_category AS ENUM ('personnel', 'survey', 'procurement', 'overhead');
CREATE TYPE product_service_category AS ENUM ('design', 'consulting', 'survey', 'supervision', 'other');

-- ─── SẢN PHẨM / DỊCH VỤ (master data) ─────────────────────────────────────

CREATE TABLE product_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  category    product_service_category NOT NULL DEFAULT 'other',
  unit_price  NUMERIC(15,0) NOT NULL DEFAULT 0,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_ps_org_code UNIQUE (org_id, code)
);

CREATE INDEX idx_ps_org      ON product_services (org_id, is_active);
CREATE INDEX idx_ps_category ON product_services (org_id, category);

CREATE TRIGGER trg_ps_ts
  BEFORE UPDATE ON product_services
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ─── DOANH THU CÔNG TY ─────────────────────────────────────────────────────

CREATE TABLE revenue_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,
  contract_id           UUID REFERENCES contracts(id) ON DELETE SET NULL,
  dept_id               UUID REFERENCES departments(id) ON DELETE SET NULL,
  dimension             revenue_dimension NOT NULL DEFAULT 'project',
  method                recognition_method NOT NULL DEFAULT 'acceptance',
  source                revenue_source NOT NULL DEFAULT 'manual',
  source_id             UUID,
  amount                NUMERIC(15,0) NOT NULL DEFAULT 0,
  description           TEXT NOT NULL,
  period_start          DATE,
  period_end            DATE,
  notes                 TEXT,
  product_service_id    UUID REFERENCES product_services(id) ON DELETE SET NULL,
  addendum_id           UUID REFERENCES contract_addendums(id) ON DELETE SET NULL,
  recognition_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  status                revenue_entry_status NOT NULL DEFAULT 'draft',
  completion_percentage NUMERIC(5,2) DEFAULT 0
    CONSTRAINT chk_re_completion CHECK (completion_percentage BETWEEN 0 AND 100),
  original_entry_id     UUID REFERENCES revenue_entries(id) ON DELETE SET NULL,
  created_by            UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_org      ON revenue_entries (org_id, dimension, created_at DESC);
CREATE INDEX idx_revenue_project  ON revenue_entries (project_id, created_at DESC);
CREATE INDEX idx_revenue_contract ON revenue_entries (contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX idx_revenue_dept     ON revenue_entries (dept_id) WHERE dept_id IS NOT NULL;
CREATE INDEX idx_re_status        ON revenue_entries (org_id, status);
CREATE INDEX idx_re_recog_date    ON revenue_entries (org_id, recognition_date);
CREATE INDEX idx_re_product       ON revenue_entries (product_service_id) WHERE product_service_id IS NOT NULL;

CREATE UNIQUE INDEX idx_re_source_unique
  ON revenue_entries (source, source_id) WHERE source_id IS NOT NULL;

-- ─── DOANH THU NỘI BỘ ──────────────────────────────────────────────────────

CREATE TABLE internal_revenue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  dept_id      UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  unit_price   NUMERIC(15,0) NOT NULL DEFAULT 0,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  status       internal_revenue_status NOT NULL DEFAULT 'pending',
  period_start DATE,
  period_end   DATE,
  notes        TEXT,
  created_by   UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intrev_org     ON internal_revenue (org_id, status, created_at DESC);
CREATE INDEX idx_intrev_dept    ON internal_revenue (dept_id, status);
CREATE INDEX idx_intrev_project ON internal_revenue (project_id) WHERE project_id IS NOT NULL;

-- ─── CHI PHÍ ────────────────────────────────────────────────────────────────

CREATE TABLE cost_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  contract_id   UUID REFERENCES contracts(id) ON DELETE SET NULL,
  dept_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
  category      cost_category NOT NULL DEFAULT 'overhead',
  description   TEXT NOT NULL,
  amount        NUMERIC(15,0) NOT NULL DEFAULT 0,
  budget_amount NUMERIC(15,0) DEFAULT 0,
  period_start  DATE,
  period_end    DATE,
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_org     ON cost_entries (org_id, category, created_at DESC);
CREATE INDEX idx_cost_project ON cost_entries (project_id, created_at DESC);
CREATE INDEX idx_cost_dept    ON cost_entries (dept_id) WHERE dept_id IS NOT NULL;

-- ─── ĐIỀU CHỈNH DOANH THU ──────────────────────────────────────────────────

CREATE TABLE revenue_adjustments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_id       UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  addendum_id       UUID NOT NULL REFERENCES contract_addendums(id) ON DELETE CASCADE,
  revenue_entry_id  UUID REFERENCES revenue_entries(id) ON DELETE SET NULL,
  old_amount        NUMERIC(15,0) NOT NULL DEFAULT 0,
  new_amount        NUMERIC(15,0) NOT NULL DEFAULT 0,
  adjustment_amount NUMERIC(15,0) GENERATED ALWAYS AS (new_amount - old_amount) STORED,
  reason            TEXT NOT NULL,
  adjusted_by       UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ra_contract ON revenue_adjustments (contract_id, created_at DESC);
CREATE INDEX idx_ra_entry    ON revenue_adjustments (revenue_entry_id) WHERE revenue_entry_id IS NOT NULL;
CREATE INDEX idx_ra_addendum ON revenue_adjustments (addendum_id);

-- ─── PHÂN BỔ DOANH THU THEO PHÒNG BAN ──────────────────────────────────────

CREATE TABLE dept_revenue_allocations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_entry_id      UUID NOT NULL REFERENCES revenue_entries(id) ON DELETE CASCADE,
  dept_id               UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,
  allocation_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  allocated_amount      NUMERIC(15,0) NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_dra_entry_dept UNIQUE (revenue_entry_id, dept_id),
  CONSTRAINT chk_dra_percentage CHECK (allocation_percentage BETWEEN 0 AND 100)
);

CREATE INDEX idx_dra_entry   ON dept_revenue_allocations (revenue_entry_id);
CREATE INDEX idx_dra_dept    ON dept_revenue_allocations (dept_id);
CREATE INDEX idx_dra_project ON dept_revenue_allocations (project_id) WHERE project_id IS NOT NULL;

CREATE TRIGGER trg_dra_ts
  BEFORE UPDATE ON dept_revenue_allocations
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE product_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dept_revenue_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY re_r ON revenue_entries FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY re_m ON revenue_entries FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

CREATE POLICY ir_r ON internal_revenue FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY ir_m ON internal_revenue FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

CREATE POLICY ce_r ON cost_entries FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY ce_m ON cost_entries FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

CREATE POLICY ps_r ON product_services FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY ps_m ON product_services FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

CREATE POLICY ra_r ON revenue_adjustments FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY ra_m ON revenue_adjustments FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

CREATE POLICY dra_r ON dept_revenue_allocations FOR SELECT
  USING (dept_id IN (SELECT id FROM departments WHERE org_id = public.user_org_id()));
CREATE POLICY dra_m ON dept_revenue_allocations FOR ALL
  USING (public.user_role() IN ('admin', 'leader', 'director')
    AND dept_id IN (SELECT id FROM departments WHERE org_id = public.user_org_id()));

-- ─── SEED DATA ──────────────────────────────────────────────────────────────

INSERT INTO product_services (org_id, code, name, category, unit_price, description)
SELECT
  o.id, v.code, v.name, v.category::product_service_category, v.price, v.description
FROM (SELECT id FROM organizations LIMIT 1) o,
(VALUES
  ('TK-KTRUC', 'Thiết kế Kiến trúc',  'design',      0, 'Thiết kế kiến trúc công trình'),
  ('TV-GSAT',  'Tư vấn Giám sát',     'supervision', 0, 'Tư vấn giám sát thi công'),
  ('KS-DHINH', 'Khảo sát Địa hình',   'survey',      0, 'Khảo sát địa hình, địa chất'),
  ('TK-KCAU',  'Thiết kế Kết cấu',    'design',      0, 'Thiết kế kết cấu công trình'),
  ('TV-TTRA',  'Tư vấn Thẩm tra',     'consulting',  0, 'Tư vấn thẩm tra thiết kế')
) AS v(code, name, category, price, description);

-- ─── FUNCTIONS ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_allocate_dept_revenue(p_entry_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entry      RECORD;
  v_dept       RECORD;
  v_total      NUMERIC(15,0);
  v_dept_count INT;
  v_top_dept   UUID;
BEGIN
  SELECT re.id, re.amount, re.project_id, re.org_id
  INTO v_entry
  FROM revenue_entries re
  WHERE re.id = p_entry_id;

  IF NOT FOUND OR v_entry.project_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_dept IN
    SELECT
      d.dept_id,
      COALESCE(dba.allocated_amount, 0) AS budget,
      COALESCE(
        ROUND(dba.allocated_amount * 100.0 / NULLIF(SUM(dba.allocated_amount) OVER (), 0), 2),
        0
      ) AS pct
    FROM project_departments d
    LEFT JOIN dept_budget_allocations dba
      ON dba.project_id = d.project_id AND dba.dept_id = d.dept_id
    WHERE d.project_id = v_entry.project_id
  LOOP
    v_dept_count := COALESCE(v_dept_count, 0) + 1;
  END LOOP;

  IF COALESCE(v_dept_count, 0) = 0 THEN
    RETURN;
  END IF;

  SELECT SUM(COALESCE(dba.allocated_amount, 0)) INTO v_total
  FROM project_departments d
  LEFT JOIN dept_budget_allocations dba
    ON dba.project_id = d.project_id AND dba.dept_id = d.dept_id
  WHERE d.project_id = v_entry.project_id;

  FOR v_dept IN
    SELECT
      d.dept_id,
      CASE
        WHEN COALESCE(v_total, 0) > 0 THEN
          ROUND(COALESCE(dba.allocated_amount, 0) * 100.0 / v_total, 2)
        ELSE
          ROUND(100.0 / v_dept_count, 2)
      END AS pct,
      CASE
        WHEN COALESCE(v_total, 0) > 0 THEN
          ROUND(v_entry.amount * COALESCE(dba.allocated_amount, 0) / v_total)
        ELSE
          ROUND(v_entry.amount / v_dept_count)
      END AS amt
    FROM project_departments d
    LEFT JOIN dept_budget_allocations dba
      ON dba.project_id = d.project_id AND dba.dept_id = d.dept_id
    WHERE d.project_id = v_entry.project_id
  LOOP
    INSERT INTO dept_revenue_allocations (
      revenue_entry_id, dept_id, project_id, allocation_percentage, allocated_amount
    ) VALUES (
      v_entry.id, v_dept.dept_id, v_entry.project_id, v_dept.pct, v_dept.amt
    )
    ON CONFLICT (revenue_entry_id, dept_id) DO NOTHING;

    IF v_top_dept IS NULL OR v_dept.pct > COALESCE(
      (SELECT allocation_percentage FROM dept_revenue_allocations
       WHERE revenue_entry_id = v_entry.id AND dept_id = v_top_dept), 0
    ) THEN
      v_top_dept := v_dept.dept_id;
    END IF;
  END LOOP;

  IF v_top_dept IS NOT NULL THEN
    UPDATE revenue_entries SET dept_id = v_top_dept WHERE id = v_entry.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_revenue_from_billing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_contract     RECORD;
  v_new_entry_id UUID;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM revenue_entries
    WHERE source = 'billing_milestone' AND source_id = NEW.id
  ) THEN RETURN NEW; END IF;

  SELECT c.id, c.org_id, c.project_id, u.id AS creator_id
  INTO v_contract
  FROM contracts c
  JOIN users u ON u.org_id = c.org_id AND u.role = 'admin'
  WHERE c.id = NEW.contract_id
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO revenue_entries (
    org_id, project_id, contract_id, dimension, method, source, source_id,
    amount, description, recognition_date, status, created_by
  ) VALUES (
    v_contract.org_id, v_contract.project_id, v_contract.id,
    'contract', 'acceptance', 'billing_milestone', NEW.id,
    NEW.amount, NEW.title, COALESCE(NEW.paid_date, CURRENT_DATE),
    'confirmed', v_contract.creator_id
  )
  RETURNING id INTO v_new_entry_id;

  PERFORM fn_allocate_dept_revenue(v_new_entry_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_revenue_from_acceptance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payment_status TEXT;
  v_old_payment    TEXT;
  v_amount         NUMERIC(15,0);
BEGIN
  IF NEW.kpi_evaluated_at IS NULL THEN RETURN NEW; END IF;

  v_payment_status := NEW.metadata->>'payment_status';
  v_old_payment    := OLD.metadata->>'payment_status';

  IF v_payment_status IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;
  IF v_old_payment IS NOT DISTINCT FROM 'paid' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM revenue_entries
    WHERE source = 'acceptance' AND source_id = NEW.id
  ) THEN RETURN NEW; END IF;

  v_amount := (NEW.metadata->>'payment_amount')::numeric;
  IF COALESCE(v_amount, 0) = 0 THEN RETURN NEW; END IF;

  INSERT INTO revenue_entries (
    org_id, project_id, dept_id, dimension, method, source, source_id,
    amount, description, recognition_date, status, created_by
  ) VALUES (
    NEW.org_id, NEW.project_id, NEW.dept_id,
    'project', 'acceptance', 'acceptance', NEW.id,
    v_amount, NEW.title, CURRENT_DATE,
    'confirmed', COALESCE(NEW.kpi_evaluated_by, NEW.assigner_id)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_revenue_adjustment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_contract  RECORD;
  v_new_value NUMERIC(15,0);
BEGIN
  SELECT c.contract_value, c.project_id, c.org_id, u.id AS admin_id
  INTO v_contract
  FROM contracts c
  JOIN users u ON u.org_id = c.org_id AND u.role = 'admin'
  WHERE c.id = NEW.contract_id
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_new_value := v_contract.contract_value + NEW.value_change;

  INSERT INTO revenue_adjustments (
    org_id, contract_id, addendum_id,
    old_amount, new_amount, reason, adjusted_by
  ) VALUES (
    v_contract.org_id, NEW.contract_id, NEW.id,
    v_contract.contract_value, v_new_value,
    'PL ' || NEW.addendum_no, NEW.created_by
  );

  IF NEW.value_change <> 0 THEN
    INSERT INTO revenue_entries (
      org_id, project_id, contract_id, addendum_id,
      dimension, method, source, source_id,
      amount, description, recognition_date, status, created_by
    ) VALUES (
      v_contract.org_id, v_contract.project_id, NEW.contract_id, NEW.id,
      'contract', 'acceptance', 'manual', NEW.id,
      NEW.value_change, 'Điều chỉnh PL ' || NEW.addendum_no,
      COALESCE(NEW.signed_date, CURRENT_DATE), 'draft', NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ─── TRIGGERS ───────────────────────────────────────────────────────────────

CREATE TRIGGER trg_billing_paid
  AFTER UPDATE OF status ON billing_milestones
  FOR EACH ROW WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION fn_revenue_from_billing();

CREATE TRIGGER trg_task_acceptance_paid
  AFTER UPDATE ON tasks
  FOR EACH ROW WHEN (NEW.status IN ('review', 'completed') AND NEW.kpi_evaluated_at IS NOT NULL)
  EXECUTE FUNCTION fn_revenue_from_acceptance();

CREATE TRIGGER trg_addendum_created
  AFTER INSERT ON contract_addendums
  FOR EACH ROW
  EXECUTE FUNCTION fn_revenue_adjustment();
