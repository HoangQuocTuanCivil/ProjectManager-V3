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

-- Phân bổ doanh thu của một revenue_entry cho các phòng ban tham gia dự án.
-- Tỷ lệ phân bổ dựa trên dept_budget_allocations nếu có, chia đều nếu không.
-- Idempotent: xoá allocation cũ trước khi tạo mới (hỗ trợ gọi lại khi amount thay đổi).
-- PB cuối cùng hấp thụ sai lệch làm tròn → SUM(allocated_amount) = entry.amount chính xác.

CREATE OR REPLACE FUNCTION fn_allocate_dept_revenue(p_entry_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry       RECORD;
  v_alloc       RECORD;
  v_running_amt NUMERIC(15,0) := 0;
  v_running_pct NUMERIC(5,2)  := 0;
  v_top_dept    UUID;
  v_top_pct     NUMERIC(5,2)  := -1;
BEGIN
  -- Lấy thông tin revenue entry cần phân bổ
  SELECT id, amount, project_id, org_id
    INTO v_entry
    FROM revenue_entries
   WHERE id = p_entry_id;

  IF NOT FOUND OR v_entry.project_id IS NULL THEN
    RETURN;
  END IF;

  -- Xoá allocation cũ để cho phép gọi lại khi amount thay đổi
  DELETE FROM dept_revenue_allocations
   WHERE revenue_entry_id = v_entry.id;

  -- Một CTE duy nhất: lấy danh sách PB, tính tỷ lệ budget, đánh số thứ tự
  FOR v_alloc IN
    WITH depts AS (
      SELECT
        pd.dept_id,
        COALESCE(dba.allocated_amount, 0)                  AS budget,
        COUNT(*) OVER ()                                   AS dept_count,
        SUM(COALESCE(dba.allocated_amount, 0)) OVER ()     AS budget_total,
        ROW_NUMBER() OVER (
          ORDER BY COALESCE(dba.allocated_amount, 0) DESC, pd.dept_id
        ) AS rn
      FROM project_departments pd
      LEFT JOIN dept_budget_allocations dba
        ON dba.project_id = pd.project_id
       AND dba.dept_id    = pd.dept_id
      WHERE pd.project_id = v_entry.project_id
    )
    SELECT
      dept_id,
      dept_count,
      rn,
      CASE WHEN budget_total > 0
        THEN ROUND(budget * 100.0 / budget_total, 2)
        ELSE ROUND(100.0 / dept_count, 2)
      END AS pct,
      CASE WHEN budget_total > 0
        THEN ROUND(v_entry.amount * budget / budget_total)
        ELSE ROUND(v_entry.amount::NUMERIC / dept_count)
      END AS amt
    FROM depts
    ORDER BY rn
  LOOP
    -- PB cuối nhận phần dư để tổng khớp chính xác với entry.amount
    IF v_alloc.rn = v_alloc.dept_count THEN
      v_alloc.amt := v_entry.amount - v_running_amt;
      v_alloc.pct := 100.00 - v_running_pct;
    END IF;

    INSERT INTO dept_revenue_allocations (
      revenue_entry_id, dept_id, project_id,
      allocation_percentage, allocated_amount
    ) VALUES (
      v_entry.id, v_alloc.dept_id, v_entry.project_id,
      v_alloc.pct, v_alloc.amt
    );

    v_running_amt := v_running_amt + v_alloc.amt;
    v_running_pct := v_running_pct + v_alloc.pct;

    -- Theo dõi PB có tỷ lệ cao nhất để gán làm PB chính
    IF v_alloc.pct > v_top_pct THEN
      v_top_pct  := v_alloc.pct;
      v_top_dept := v_alloc.dept_id;
    END IF;
  END LOOP;

  -- Gán PB chính (có % cao nhất) vào revenue_entries.dept_id
  IF v_top_dept IS NOT NULL THEN
    UPDATE revenue_entries SET dept_id = v_top_dept WHERE id = v_entry.id;
  END IF;
END;
$$;

-- Tự động tạo revenue_entry khi billing_milestone chuyển sang 'paid'.
-- Gán nguồn gốc (source) = 'billing_milestone' để truy vết về mốc thanh toán gốc.
-- Sau khi tạo entry, phân bổ doanh thu cho các phòng ban qua fn_allocate_dept_revenue.

CREATE OR REPLACE FUNCTION fn_revenue_from_billing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract     RECORD;
  v_creator_id   UUID;
  v_new_entry_id UUID;
BEGIN
  -- Guard: chỉ xử lý khi status thực sự thay đổi sang 'paid'
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;

  -- Idempotent: nếu milestone này đã có revenue entry → bỏ qua
  IF EXISTS (
    SELECT 1 FROM revenue_entries
    WHERE source = 'billing_milestone' AND source_id = NEW.id
  ) THEN RETURN NEW; END IF;

  -- Lấy thông tin hợp đồng (org, project) để gán vào revenue entry
  SELECT c.id, c.org_id, c.project_id
    INTO v_contract
    FROM contracts c
   WHERE c.id = NEW.contract_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Ưu tiên user đang thao tác, fallback về admin của org khi gọi từ cron/system
  v_creator_id := COALESCE(
    auth.uid(),
    (SELECT id FROM users
      WHERE org_id = v_contract.org_id AND role = 'admin' AND is_active = TRUE
      ORDER BY created_at LIMIT 1)
  );

  IF v_creator_id IS NULL THEN RETURN NEW; END IF;

  -- Tạo revenue entry từ thông tin milestone và hợp đồng
  INSERT INTO revenue_entries (
    org_id, project_id, contract_id,
    dimension, method, source, source_id,
    amount, description,
    recognition_date, status,
    period_start, period_end,
    created_by
  ) VALUES (
    v_contract.org_id, v_contract.project_id, v_contract.id,
    'contract',                              -- doanh thu theo hợp đồng
    'acceptance',                            -- phương pháp nghiệm thu
    'billing_milestone', NEW.id,             -- trỏ về milestone gốc
    NEW.amount, NEW.title,
    COALESCE(NEW.paid_date, CURRENT_DATE),   -- ngày ghi nhận = ngày thanh toán
    'confirmed',                             -- tự động xác nhận từ billing
    NEW.paid_date, NEW.paid_date,            -- kỳ ghi nhận = ngày thanh toán
    v_creator_id
  )
  RETURNING id INTO v_new_entry_id;

  -- Phân bổ doanh thu cho các phòng ban tham gia dự án
  PERFORM fn_allocate_dept_revenue(v_new_entry_id);
  RETURN NEW;
END;
$$;

-- Tự động tạo revenue_entry khi task đồng thời thoả 2 điều kiện:
--   1. kpi_evaluated_at IS NOT NULL  (đã nghiệm thu KPI)
--   2. metadata->>'payment_status' = 'paid'  (đã thanh toán)
-- Hỗ trợ cả 2 thứ tự: KPI trước rồi payment, hoặc payment trước rồi KPI.
-- Guard: chỉ tạo revenue khi UPDATE này làm cả 2 điều kiện lần đầu đồng thời thoả.

CREATE OR REPLACE FUNCTION fn_revenue_from_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount      NUMERIC(15,0);
  v_recog_date  DATE;
BEGIN
  -- Điều kiện hiện tại: cả 2 phải thoả trên NEW
  IF NEW.kpi_evaluated_at IS NULL THEN RETURN NEW; END IF;
  IF (NEW.metadata->>'payment_status') IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;

  -- Guard chống trùng: nếu TRƯỚC update cả 2 đã đồng thời thoả → không phải
  -- lần đầu chuyển trạng thái, bỏ qua để tránh tạo revenue entry trùng lặp
  IF OLD.kpi_evaluated_at IS NOT NULL
     AND (OLD.metadata->>'payment_status') = 'paid'
  THEN
    RETURN NEW;
  END IF;

  -- Idempotent: task này đã có revenue entry rồi → bỏ qua
  IF EXISTS (
    SELECT 1 FROM revenue_entries
    WHERE source = 'acceptance' AND source_id = NEW.id
  ) THEN RETURN NEW; END IF;

  -- Lấy số tiền thanh toán từ metadata, bỏ qua nếu = 0 hoặc không hợp lệ
  v_amount := (NEW.metadata->>'payment_amount')::numeric;
  IF COALESCE(v_amount, 0) = 0 THEN RETURN NEW; END IF;

  -- Ngày ghi nhận: ưu tiên payment_date từ form, fallback về hôm nay
  v_recog_date := COALESCE(
    (NEW.metadata->>'payment_date')::date,
    CURRENT_DATE
  );

  -- Tạo revenue entry liên kết trực tiếp với phòng ban thực hiện task
  INSERT INTO revenue_entries (
    org_id, project_id, dept_id,
    dimension, method, source, source_id,
    amount, description,
    recognition_date, status,
    period_start, period_end,
    created_by
  ) VALUES (
    NEW.org_id, NEW.project_id, NEW.dept_id,
    'project',                                -- doanh thu theo dự án
    'acceptance',                              -- phương pháp nghiệm thu
    'acceptance', NEW.id,                      -- trỏ về task gốc
    v_amount, NEW.title,
    v_recog_date,                              -- ngày ghi nhận doanh thu
    'confirmed',                               -- tự động xác nhận
    v_recog_date, v_recog_date,                -- kỳ ghi nhận
    COALESCE(NEW.kpi_evaluated_by, NEW.assigner_id)
  );

  RETURN NEW;
END;
$$;

-- Khi phụ lục hợp đồng được thêm, tự động:
--   1. Cập nhật contracts.contract_value và projects.budget theo value_change
--   2. Ghi audit trail vào revenue_adjustments (old/new amount)
--   3. Tạo revenue_entry draft cho phần chênh lệch (dương = tăng, âm = giảm)
-- Frontend KHÔNG cần tự update contract_value — trigger xử lý toàn bộ.

CREATE OR REPLACE FUNCTION fn_revenue_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract       RECORD;
  v_new_value      NUMERIC(15,0);
  v_new_entry_id   UUID;
  v_recog_date     DATE;
BEGIN
  -- Lấy thông tin hợp đồng hiện tại (giá trị trước điều chỉnh)
  SELECT c.id, c.contract_value, c.project_id, c.org_id
    INTO v_contract
    FROM contracts c
   WHERE c.id = NEW.contract_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_new_value  := v_contract.contract_value + NEW.value_change;
  v_recog_date := COALESCE(NEW.signed_date, CURRENT_DATE);

  -- Cập nhật giá trị hợp đồng (cộng/trừ theo value_change)
  UPDATE contracts
     SET contract_value = v_new_value,
         end_date       = COALESCE(NEW.new_end_date, end_date),
         updated_at     = NOW()
   WHERE id = NEW.contract_id;

  -- Đồng bộ budget dự án theo giá trị hợp đồng mới
  UPDATE projects
     SET budget     = v_new_value,
         updated_at = NOW()
   WHERE id = v_contract.project_id;

  -- Tạo revenue entry draft cho phần chênh lệch (cả dương lẫn âm)
  IF NEW.value_change <> 0 THEN
    INSERT INTO revenue_entries (
      org_id, project_id, contract_id, addendum_id,
      dimension, method, source, source_id,
      amount, description,
      recognition_date, status,
      period_start, period_end,
      created_by
    ) VALUES (
      v_contract.org_id, v_contract.project_id, NEW.contract_id, NEW.id,
      'contract',                                    -- doanh thu theo hợp đồng
      'acceptance',                                  -- phương pháp nghiệm thu
      'manual', NEW.id,                              -- nguồn: phụ lục thủ công
      NEW.value_change,                              -- dương = tăng DT, âm = giảm DT
      'Điều chỉnh PL ' || NEW.addendum_no,
      v_recog_date, 'draft',                         -- draft chờ admin xác nhận
      v_recog_date, v_recog_date,                    -- kỳ ghi nhận
      NEW.created_by
    )
    RETURNING id INTO v_new_entry_id;
  END IF;

  -- Ghi audit trail: giá trị cũ → mới, liên kết với revenue entry nếu có
  INSERT INTO revenue_adjustments (
    org_id, contract_id, addendum_id, revenue_entry_id,
    old_amount, new_amount,
    reason, adjusted_by
  ) VALUES (
    v_contract.org_id, NEW.contract_id, NEW.id, v_new_entry_id,
    v_contract.contract_value, v_new_value,
    'PL ' || NEW.addendum_no, NEW.created_by
  );

  RETURN NEW;
END;
$$;

-- ─── TRIGGERS ───────────────────────────────────────────────────────────────

CREATE TRIGGER trg_billing_paid
  AFTER UPDATE OF status ON billing_milestones
  FOR EACH ROW WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION fn_revenue_from_billing();

CREATE TRIGGER trg_task_acceptance_paid
  AFTER UPDATE OF status, metadata, kpi_evaluated_at ON tasks
  FOR EACH ROW WHEN (NEW.status IN ('review', 'completed') AND NEW.kpi_evaluated_at IS NOT NULL)
  EXECUTE FUNCTION fn_revenue_from_acceptance();

CREATE TRIGGER trg_addendum_created
  AFTER INSERT ON contract_addendums
  FOR EACH ROW
  EXECUTE FUNCTION fn_revenue_adjustment();
