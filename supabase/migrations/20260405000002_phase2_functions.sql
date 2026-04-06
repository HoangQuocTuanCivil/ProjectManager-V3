-- ============================================================================
-- A2Z WORKHUB — PHASE 2: VIEWS, FUNCTIONS, TRIGGERS, INDEXES
--
-- Views:     v_expected_fund, v_dept_fund_summary, v_employee_bonus,
--            v_contract_profitloss
-- Functions: fn_calc_actual_fund, fn_calc_bonus, fn_apply_deductions,
--            fn_handle_addendum_rollback
-- Triggers:  trg_salary_apply_deductions, trg_addendum_rollback
-- Indexes:   tối ưu cho queries nặng (báo cáo, quỹ PB, tính thưởng)
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── QUỸ DỰ KIẾN THEO PHÒNG BAN ────────────────────────────────────────────
-- Tổng hợp quỹ dự kiến mỗi phòng ban từ tất cả hợp đồng active/completed:
--   expected_fund = SUM(contract_value × budget_share × difficulty_factor)
-- Nếu dự án chưa có dept_budget_allocations → chia đều cho các PB tham gia.

CREATE OR REPLACE VIEW v_expected_fund AS
WITH project_budget AS (
  SELECT
    pd.project_id,
    pd.dept_id,
    c.contract_value,
    p.org_id,
    COALESCE(dba.allocated_amount, 0)            AS dept_budget,
    SUM(COALESCE(dba.allocated_amount, 0))
      OVER (PARTITION BY pd.project_id)          AS total_budget,
    COUNT(*) OVER (PARTITION BY pd.project_id)   AS dept_count
  FROM project_departments pd
  JOIN projects p ON p.id = pd.project_id
  JOIN contracts c ON c.project_id = pd.project_id
    AND c.status IN ('active', 'completed')
  LEFT JOIN dept_budget_allocations dba
    ON dba.project_id = pd.project_id
   AND dba.dept_id    = pd.dept_id
),
fund_calc AS (
  SELECT
    pb.org_id,
    pb.dept_id,
    pb.project_id,
    pb.contract_value,
    CASE
      WHEN pb.total_budget > 0
        THEN pb.contract_value * pb.dept_budget / pb.total_budget
      ELSE pb.contract_value / pb.dept_count
    END AS base_fund,
    COALESCE(pdf.difficulty_factor, 1.00) AS factor
  FROM project_budget pb
  LEFT JOIN project_dept_factors pdf
    ON pdf.project_id = pb.project_id
   AND pdf.dept_id    = pb.dept_id
)
SELECT
  fc.org_id,
  fc.dept_id,
  d.name                                    AS dept_name,
  d.code                                    AS dept_code,
  COUNT(DISTINCT fc.project_id)             AS project_count,
  ROUND(SUM(fc.base_fund))                  AS raw_fund,
  ROUND(SUM(fc.base_fund * fc.factor))      AS expected_fund,
  ROUND(AVG(fc.factor), 2)                  AS avg_factor
FROM fund_calc fc
JOIN departments d ON d.id = fc.dept_id
GROUP BY fc.org_id, fc.dept_id, d.name, d.code;

-- ─── TỔNG HỢP QUỸ PHÒNG BAN ───────────────────────────────────────────────
-- Dashboard overview: dự kiến / thực tế / chi phí / lương / còn lại per PB.
-- Để xem theo kỳ cụ thể, dùng fn_calc_actual_fund().

CREATE OR REPLACE VIEW v_dept_fund_summary AS
WITH dept_revenue AS (
  SELECT dra.dept_id, SUM(dra.allocated_amount) AS actual_revenue
  FROM dept_revenue_allocations dra
  JOIN revenue_entries re ON re.id = dra.revenue_entry_id
  WHERE re.status = 'confirmed'
  GROUP BY dra.dept_id
),
dept_costs AS (
  SELECT ce.dept_id, SUM(ce.amount) AS total_costs
  FROM cost_entries ce
  WHERE ce.dept_id IS NOT NULL
  GROUP BY ce.dept_id
),
dept_internal AS (
  SELECT ir.dept_id, SUM(ir.total_amount) AS internal_rev
  FROM internal_revenue ir
  WHERE ir.status = 'approved'
  GROUP BY ir.dept_id
),
dept_salary AS (
  SELECT sr.dept_id, SUM(sr.base_salary) AS total_salary
  FROM salary_records sr
  WHERE sr.dept_id IS NOT NULL
  GROUP BY sr.dept_id
)
SELECT
  d.id                                              AS dept_id,
  d.org_id,
  d.name                                            AS dept_name,
  d.code                                            AS dept_code,
  COALESCE(ef.expected_fund, 0)                     AS expected_fund,
  COALESCE(dr.actual_revenue, 0)                    AS actual_revenue,
  COALESCE(di.internal_rev, 0)                      AS internal_rev,
  COALESCE(dc.total_costs, 0)                       AS total_costs,
  COALESCE(ds.total_salary, 0)                      AS total_salary,
  COALESCE(dr.actual_revenue, 0)
    + COALESCE(di.internal_rev, 0)
    - COALESCE(dc.total_costs, 0)
    - COALESCE(ds.total_salary, 0)                  AS net_fund
FROM departments d
LEFT JOIN v_expected_fund ef   ON ef.dept_id = d.id
LEFT JOIN dept_revenue dr      ON dr.dept_id = d.id
LEFT JOIN dept_costs dc        ON dc.dept_id = d.id
LEFT JOIN dept_internal di     ON di.dept_id = d.id
LEFT JOIN dept_salary ds       ON ds.dept_id = d.id
WHERE d.is_active = TRUE;

-- ─── THƯỞNG / NỢ CÁ NHÂN ──────────────────────────────────────────────────
-- Tổng hợp kết quả khoán + lương + thưởng/nợ cho từng NV theo đợt khoán.

CREATE OR REPLACE VIEW v_employee_bonus AS
SELECT
  ar.id                                       AS result_id,
  ap.id                                       AS period_id,
  ap.name                                     AS period_name,
  ap.period_start,
  ap.period_end,
  ap.org_id,
  ar.user_id,
  u.full_name,
  u.email,
  d.id                                        AS dept_id,
  d.name                                      AS dept_name,
  COALESCE(ar.allocated_amount, 0)            AS allocated_amount,
  COALESCE(ar.total_salary_paid, 0)           AS total_salary,
  COALESCE(ar.bonus_amount, 0)                AS bonus_amount,
  CASE
    WHEN ar.deduction_id IS NOT NULL THEN COALESCE(sd.remaining_amount, 0)
    ELSE 0
  END                                         AS deduction_remaining,
  CASE
    WHEN ar.bonus_amount > 0 THEN 'bonus'
    WHEN ar.deduction_id IS NOT NULL THEN 'deduction'
    ELSE 'balanced'
  END                                         AS outcome
FROM allocation_results ar
JOIN allocation_periods ap ON ap.id = ar.period_id
JOIN users u               ON u.id = ar.user_id
LEFT JOIN departments d    ON d.id = u.dept_id
LEFT JOIN salary_deductions sd ON sd.id = ar.deduction_id;

-- ─── LÃI LỖ THEO HỢP ĐỒNG ─────────────────────────────────────────────────
-- Tổng hợp doanh thu confirmed vs chi phí cho từng hợp đồng.

CREATE OR REPLACE VIEW v_contract_profitloss AS
WITH contract_revenue AS (
  SELECT re.contract_id, SUM(re.amount) AS total_revenue
  FROM revenue_entries re
  WHERE re.status = 'confirmed' AND re.contract_id IS NOT NULL
  GROUP BY re.contract_id
),
contract_costs AS (
  SELECT ce.contract_id, SUM(ce.amount) AS total_costs
  FROM cost_entries ce
  WHERE ce.contract_id IS NOT NULL
  GROUP BY ce.contract_id
)
SELECT
  c.id                                                  AS contract_id,
  c.org_id,
  c.project_id,
  c.contract_no,
  c.title                                               AS contract_title,
  c.client_name,
  c.contract_value,
  c.status                                              AS contract_status,
  c.signed_date,
  p.code                                                AS project_code,
  p.name                                                AS project_name,
  COALESCE(cr.total_revenue, 0)                         AS total_revenue,
  COALESCE(cc.total_costs, 0)                           AS total_costs,
  COALESCE(cr.total_revenue, 0) - COALESCE(cc.total_costs, 0) AS profit,
  CASE WHEN c.contract_value > 0
    THEN ROUND(COALESCE(cr.total_revenue, 0) * 100.0 / c.contract_value, 1)
    ELSE 0
  END                                                   AS revenue_pct,
  CASE WHEN COALESCE(cr.total_revenue, 0) > 0
    THEN ROUND(
      (COALESCE(cr.total_revenue, 0) - COALESCE(cc.total_costs, 0)) * 100.0
      / COALESCE(cr.total_revenue, 0), 1)
    ELSE 0
  END                                                   AS margin_pct
FROM contracts c
JOIN projects p ON p.id = c.project_id
LEFT JOIN contract_revenue cr ON cr.contract_id = c.id
LEFT JOIN contract_costs cc   ON cc.contract_id = c.id;


-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── QUỸ KHOÁN THỰC TẾ CHO 1 PB TRONG 1 KỲ ────────────────────────────────
-- actual_fund = (SUM allocated_revenue × AVG difficulty_factor)
--               − SUM cost_entries + SUM internal_revenue (approved)

CREATE OR REPLACE FUNCTION fn_calc_actual_fund(
  p_dept_id  UUID,
  p_start    DATE,
  p_end      DATE
)
RETURNS TABLE (
  dept_id            UUID,
  revenue_allocated  NUMERIC(15,0),
  avg_factor         NUMERIC(4,2),
  adjusted_revenue   NUMERIC(15,0),
  total_costs        NUMERIC(15,0),
  internal_rev       NUMERIC(15,0),
  actual_fund        NUMERIC(15,0)
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_revenue   NUMERIC(15,0);
  v_factor    NUMERIC(4,2);
  v_adj_rev   NUMERIC(15,0);
  v_costs     NUMERIC(15,0);
  v_internal  NUMERIC(15,0);
BEGIN
  -- Tổng doanh thu đã phân bổ cho PB trong kỳ (chỉ entries confirmed)
  SELECT COALESCE(SUM(dra.allocated_amount), 0)
    INTO v_revenue
    FROM dept_revenue_allocations dra
    JOIN revenue_entries re ON re.id = dra.revenue_entry_id
   WHERE dra.dept_id = p_dept_id
     AND re.status = 'confirmed'
     AND re.recognition_date BETWEEN p_start AND p_end;

  -- Hệ số khó trung bình từ các dự án có doanh thu phân bổ trong kỳ
  SELECT COALESCE(AVG(pdf.difficulty_factor), 1.00)
    INTO v_factor
    FROM project_dept_factors pdf
   WHERE pdf.dept_id = p_dept_id
     AND pdf.project_id IN (
       SELECT DISTINCT dra.project_id
         FROM dept_revenue_allocations dra
         JOIN revenue_entries re ON re.id = dra.revenue_entry_id
        WHERE dra.dept_id = p_dept_id
          AND re.status = 'confirmed'
          AND re.recognition_date BETWEEN p_start AND p_end
          AND dra.project_id IS NOT NULL
     );

  v_adj_rev := ROUND(v_revenue * v_factor);

  -- Tổng chi phí phát sinh của PB trong kỳ
  SELECT COALESCE(SUM(ce.amount), 0)
    INTO v_costs
    FROM cost_entries ce
   WHERE ce.dept_id = p_dept_id
     AND ce.period_start IS NOT NULL
     AND ce.period_start <= p_end
     AND COALESCE(ce.period_end, ce.period_start) >= p_start;

  -- Tổng doanh thu nội bộ đã duyệt của PB trong kỳ
  SELECT COALESCE(SUM(ir.total_amount), 0)
    INTO v_internal
    FROM internal_revenue ir
   WHERE ir.dept_id = p_dept_id
     AND ir.status = 'approved'
     AND ir.period_start IS NOT NULL
     AND ir.period_start <= p_end
     AND COALESCE(ir.period_end, ir.period_start) >= p_start;

  RETURN QUERY SELECT
    p_dept_id, v_revenue, v_factor, v_adj_rev, v_costs, v_internal,
    v_adj_rev - v_costs + v_internal;
END;
$$;

-- ─── TÍNH THƯỞNG KHOÁN CHO 1 ĐỢT ──────────────────────────────────────────
-- Loop allocation_results → SUM salary → bonus = alloc − salary
-- Dương → ghi thưởng. Âm → tạo salary_deductions trừ dần 3 tháng.

CREATE OR REPLACE FUNCTION fn_calc_bonus(p_period_id UUID)
RETURNS TABLE (
  user_id          UUID,
  allocated_amount NUMERIC(15,0),
  total_salary     NUMERIC(15,0),
  bonus            NUMERIC(15,0),
  has_deduction    BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period       RECORD;
  v_result       RECORD;
  v_total_salary NUMERIC(15,0);
  v_bonus        NUMERIC(15,0);
  v_deduction_id UUID;
  v_monthly      NUMERIC(15,0);
BEGIN
  SELECT id, org_id, period_start, period_end
    INTO v_period
    FROM allocation_periods
   WHERE id = p_period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation period % not found', p_period_id;
  END IF;

  FOR v_result IN
    SELECT ar.id, ar.user_id, COALESCE(ar.allocated_amount, 0) AS alloc_amt
      FROM allocation_results ar
     WHERE ar.period_id = p_period_id
  LOOP
    SELECT COALESCE(SUM(sr.base_salary), 0)
      INTO v_total_salary
      FROM salary_records sr
     WHERE sr.user_id = v_result.user_id
       AND sr.month >= v_period.period_start
       AND sr.month <= v_period.period_end;

    v_bonus := v_result.alloc_amt - v_total_salary;
    v_deduction_id := NULL;

    IF v_bonus < 0 THEN
      v_monthly := GREATEST(ROUND(ABS(v_bonus) / 3.0), 1);

      INSERT INTO salary_deductions (
        org_id, user_id, period_id,
        total_amount, remaining_amount, monthly_deduction,
        status, reason
      ) VALUES (
        v_period.org_id, v_result.user_id, p_period_id,
        ABS(v_bonus), ABS(v_bonus), v_monthly,
        'active',
        'Khoán âm kỳ ' || v_period.period_start || ' → ' || v_period.period_end
      )
      ON CONFLICT (user_id, period_id)
        DO UPDATE SET
          total_amount      = ABS(v_bonus),
          remaining_amount  = ABS(v_bonus),
          monthly_deduction = GREATEST(ROUND(ABS(v_bonus) / 3.0), 1),
          status            = 'active',
          updated_at        = NOW()
      RETURNING id INTO v_deduction_id;
    END IF;

    UPDATE allocation_results
       SET total_salary_paid = v_total_salary,
           bonus_amount      = GREATEST(v_bonus, 0),
           deduction_id      = v_deduction_id
     WHERE id = v_result.id;

    RETURN QUERY SELECT
      v_result.user_id, v_result.alloc_amt, v_total_salary,
      v_bonus, v_deduction_id IS NOT NULL;
  END LOOP;
END;
$$;

-- ─── TỰ ĐỘNG KHẤU TRỪ KHI NHẬP LƯƠNG MỚI ─────────────────────────────────
-- Tìm deduction active cũ nhất của NV, trừ monthly_deduction vào lương,
-- giảm remaining_amount. Nếu remaining = 0 → đánh dấu completed.

CREATE OR REPLACE FUNCTION fn_apply_deductions()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ded           RECORD;
  v_apply         NUMERIC(15,0);
  v_total_applied NUMERIC(15,0) := 0;
BEGIN
  FOR v_ded IN
    SELECT id, remaining_amount, monthly_deduction
      FROM salary_deductions
     WHERE user_id = NEW.user_id
       AND status = 'active'
       AND remaining_amount > 0
     ORDER BY created_at ASC
  LOOP
    v_apply := LEAST(v_ded.monthly_deduction, v_ded.remaining_amount);

    UPDATE salary_deductions
       SET remaining_amount = remaining_amount - v_apply,
           status = CASE
             WHEN remaining_amount - v_apply <= 0 THEN 'completed'
             ELSE status
           END
     WHERE id = v_ded.id;

    v_total_applied := v_total_applied + v_apply;
  END LOOP;

  IF v_total_applied > 0 THEN
    NEW.deduction_applied := v_total_applied;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── ROLLBACK PHỤ LỤC GIẢM GIÁ TRỊ ────────────────────────────────────────
-- Khi phụ lục value_change < 0 và đợt khoán đã chi (paid) → tạo
-- salary_deductions cho NV trong PB bị ảnh hưởng theo tỷ lệ sản lượng.

CREATE OR REPLACE FUNCTION fn_handle_addendum_rollback()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_contract    RECORD;
  v_dept        RECORD;
  v_impact      NUMERIC(15,0);
  v_period      RECORD;
  v_user_share  NUMERIC(15,0);
  v_result      RECORD;
BEGIN
  IF NEW.value_change >= 0 THEN RETURN NEW; END IF;

  SELECT c.id, c.org_id, c.project_id
    INTO v_contract
    FROM contracts c
   WHERE c.id = NEW.contract_id;

  IF NOT FOUND OR v_contract.project_id IS NULL THEN RETURN NEW; END IF;

  FOR v_dept IN
    WITH dept_shares AS (
      SELECT
        pd.dept_id,
        COALESCE(dba.allocated_amount, 0)              AS budget,
        SUM(COALESCE(dba.allocated_amount, 0)) OVER () AS total,
        COUNT(*) OVER ()                                AS dept_count
      FROM project_departments pd
      LEFT JOIN dept_budget_allocations dba
        ON dba.project_id = pd.project_id AND dba.dept_id = pd.dept_id
      WHERE pd.project_id = v_contract.project_id
    )
    SELECT dept_id,
      CASE WHEN total > 0
        THEN ROUND(ABS(NEW.value_change) * budget / total)
        ELSE ROUND(ABS(NEW.value_change)::NUMERIC / dept_count)
      END AS impact_amount
    FROM dept_shares
  LOOP
    v_impact := v_dept.impact_amount;
    IF v_impact <= 0 THEN CONTINUE; END IF;

    SELECT ap.id, ap.period_start, ap.period_end, ap.org_id
      INTO v_period
      FROM allocation_periods ap
     WHERE ap.status = 'paid'
       AND (ap.project_id = v_contract.project_id OR ap.project_id IS NULL)
       AND ap.org_id = v_contract.org_id
     ORDER BY ap.period_end DESC
     LIMIT 1;

    IF NOT FOUND THEN CONTINUE; END IF;

    FOR v_result IN
      SELECT ar.id, ar.user_id, ar.allocated_amount, ar.share_percentage
        FROM allocation_results ar
        JOIN users u ON u.id = ar.user_id AND u.dept_id = v_dept.dept_id
       WHERE ar.period_id = v_period.id
         AND COALESCE(ar.allocated_amount, 0) > 0
    LOOP
      v_user_share := GREATEST(ROUND(v_impact * v_result.share_percentage), 1);

      INSERT INTO salary_deductions (
        org_id, user_id, period_id,
        total_amount, remaining_amount, monthly_deduction,
        status, reason
      ) VALUES (
        v_contract.org_id, v_result.user_id, v_period.id,
        v_user_share, v_user_share,
        GREATEST(ROUND(v_user_share / 3.0), 1),
        'active',
        'Rollback PL ' || NEW.addendum_no || ' giảm ' || ABS(NEW.value_change)
      )
      ON CONFLICT (user_id, period_id) DO UPDATE SET
        total_amount      = salary_deductions.total_amount + v_user_share,
        remaining_amount  = salary_deductions.remaining_amount + v_user_share,
        monthly_deduction = GREATEST(
          ROUND((salary_deductions.total_amount + v_user_share) / 3.0), 1),
        reason = salary_deductions.reason || '; PL ' || NEW.addendum_no,
        updated_at = NOW();
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_salary_apply_deductions
  BEFORE INSERT ON salary_records
  FOR EACH ROW
  EXECUTE FUNCTION fn_apply_deductions();

-- Fire SAU trg_addendum_created (chữ 'r' > 'c' theo alphabet)
CREATE TRIGGER trg_addendum_rollback
  AFTER INSERT ON contract_addendums
  FOR EACH ROW
  WHEN (NEW.value_change < 0)
  EXECUTE FUNCTION fn_handle_addendum_rollback();


-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES TỐI ƯU
-- ═══════════════════════════════════════════════════════════════════════════

-- Báo cáo doanh thu theo kỳ: chỉ entries confirmed
CREATE INDEX IF NOT EXISTS idx_re_confirmed_date
  ON revenue_entries (recognition_date, amount)
  WHERE status = 'confirmed';

-- Quỹ PB: join dept_revenue_allocations ↔ revenue_entries
CREATE INDEX IF NOT EXISTS idx_dra_dept_entry
  ON dept_revenue_allocations (dept_id, revenue_entry_id);

-- Chi phí theo kỳ cho fn_calc_actual_fund
CREATE INDEX IF NOT EXISTS idx_cost_period
  ON cost_entries (dept_id, period_start)
  WHERE dept_id IS NOT NULL AND period_start IS NOT NULL;

-- DT nội bộ approved theo kỳ
CREATE INDEX IF NOT EXISTS idx_intrev_approved_period
  ON internal_revenue (dept_id, period_start)
  WHERE status = 'approved' AND period_start IS NOT NULL;

SELECT '✅ Phase 2 functions: 4 views + 4 functions + 2 triggers + indexes created' AS status;
