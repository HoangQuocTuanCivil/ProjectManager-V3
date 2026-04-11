-- ============================================================================
-- A2Z WORKHUB — DATABASE VIEWS (consolidated)
-- Tất cả view báo cáo: quỹ khoán, tổng hợp phòng ban, thưởng, lãi lỗ
-- ============================================================================

-- ─── v_expected_fund ─────────────────────────────────────────────────────────
-- Quỹ dự kiến theo phòng ban = số tiền giao khoán x hệ số khó
-- Hỗ trợ 2 kiểu: giao trực tiếp cho PB hoặc giao cho trung tâm (chia đều PB)

CREATE OR REPLACE VIEW v_expected_fund AS
WITH budget_by_dept AS (
  -- Giao khoán trực tiếp cho phòng ban
  SELECT
    dba.org_id,
    dba.project_id,
    dba.dept_id,
    dba.allocated_amount AS base_fund
  FROM dept_budget_allocations dba
  WHERE dba.dept_id IS NOT NULL

  UNION ALL

  -- Giao khoán cho trung tâm: phân bổ đều cho các PB trong TT
  SELECT
    dba.org_id,
    dba.project_id,
    dep.id AS dept_id,
    ROUND(dba.allocated_amount::NUMERIC / GREATEST(COUNT(*) OVER (PARTITION BY dba.id), 1)) AS base_fund
  FROM dept_budget_allocations dba
  JOIN departments dep ON dep.center_id = dba.center_id AND dep.is_active = TRUE
  WHERE dba.center_id IS NOT NULL AND dba.dept_id IS NULL
),
fund_calc AS (
  SELECT
    bd.org_id,
    bd.dept_id,
    bd.project_id,
    bd.base_fund,
    COALESCE(pdf.difficulty_factor, 1.00) AS factor
  FROM budget_by_dept bd
  LEFT JOIN project_dept_factors pdf
    ON pdf.project_id = bd.project_id AND pdf.dept_id = bd.dept_id
)
SELECT
  fc.org_id, fc.dept_id,
  d.name AS dept_name, d.code AS dept_code,
  COUNT(DISTINCT fc.project_id)        AS project_count,
  ROUND(SUM(fc.base_fund))             AS raw_fund,
  ROUND(SUM(fc.base_fund * fc.factor)) AS expected_fund,
  ROUND(AVG(fc.factor), 2)             AS avg_factor
FROM fund_calc fc
JOIN departments d ON d.id = fc.dept_id
GROUP BY fc.org_id, fc.dept_id, d.name, d.code;

-- ─── v_dept_fund_summary ────────────────────────────────────────────────────
-- Tổng hợp quỹ phòng ban: dự kiến / DT thực / DT nội bộ / chi phí / lương / còn lại

CREATE OR REPLACE VIEW v_dept_fund_summary AS
WITH dept_revenue AS (
  SELECT dra.dept_id, SUM(dra.allocated_amount) AS actual_revenue
  FROM dept_revenue_allocations dra
  JOIN revenue_entries re ON re.id = dra.revenue_entry_id
  WHERE re.status = 'confirmed' GROUP BY dra.dept_id
),
dept_costs AS (
  SELECT ce.dept_id, SUM(ce.amount) AS total_costs
  FROM cost_entries ce WHERE ce.dept_id IS NOT NULL GROUP BY ce.dept_id
),
dept_internal AS (
  SELECT ir.dept_id, SUM(ir.total_amount) AS internal_rev
  FROM internal_revenue ir WHERE ir.status = 'approved' GROUP BY ir.dept_id
),
dept_salary AS (
  SELECT sr.dept_id, SUM(sr.base_salary) AS total_salary
  FROM salary_records sr WHERE sr.dept_id IS NOT NULL GROUP BY sr.dept_id
)
SELECT
  d.id AS dept_id, d.org_id, d.name AS dept_name, d.code AS dept_code,
  COALESCE(ef.expected_fund, 0)    AS expected_fund,
  COALESCE(dr.actual_revenue, 0)   AS actual_revenue,
  COALESCE(di.internal_rev, 0)     AS internal_rev,
  COALESCE(dc.total_costs, 0)      AS total_costs,
  COALESCE(ds.total_salary, 0)     AS total_salary,
  COALESCE(dr.actual_revenue, 0) + COALESCE(di.internal_rev, 0)
    - COALESCE(dc.total_costs, 0) - COALESCE(ds.total_salary, 0) AS net_fund
FROM departments d
LEFT JOIN v_expected_fund ef ON ef.dept_id = d.id
LEFT JOIN dept_revenue dr    ON dr.dept_id = d.id
LEFT JOIN dept_costs dc      ON dc.dept_id = d.id
LEFT JOIN dept_internal di   ON di.dept_id = d.id
LEFT JOIN dept_salary ds     ON ds.dept_id = d.id
WHERE d.is_active = TRUE;

-- ─── v_employee_bonus ───────────────────────────────────────────────────────
-- Thưởng/nợ cá nhân: kết quả phân bổ khoán cho từng nhân sự theo đợt

CREATE OR REPLACE VIEW v_employee_bonus AS
SELECT
  ar.id AS result_id, ap.id AS period_id, ap.name AS period_name,
  ap.period_start, ap.period_end, ap.org_id,
  ar.user_id, u.full_name, u.email,
  d.id AS dept_id, d.name AS dept_name,
  COALESCE(ar.allocated_amount, 0) AS allocated_amount,
  COALESCE(ar.total_salary_paid, 0) AS total_salary,
  COALESCE(ar.bonus_amount, 0) AS bonus_amount,
  CASE WHEN ar.deduction_id IS NOT NULL THEN COALESCE(sd.remaining_amount, 0) ELSE 0 END AS deduction_remaining,
  CASE WHEN ar.bonus_amount > 0 THEN 'bonus' WHEN ar.deduction_id IS NOT NULL THEN 'deduction' ELSE 'balanced' END AS outcome
FROM allocation_results ar
JOIN allocation_periods ap ON ap.id = ar.period_id
JOIN users u ON u.id = ar.user_id
LEFT JOIN departments d ON d.id = u.dept_id
LEFT JOIN salary_deductions sd ON sd.id = ar.deduction_id;

-- ─── v_contract_profitloss ──────────────────────────────────────────────────
-- Lãi lỗ theo hợp đồng: doanh thu confirmed - chi phí, tỷ lệ DT/giá trị HĐ, biên lợi nhuận
-- Lọc bỏ HĐ và dự án đã xóa mềm (deleted_at IS NULL)

CREATE OR REPLACE VIEW v_contract_profitloss AS
WITH contract_revenue AS (
  SELECT re.contract_id, SUM(re.amount) AS total_revenue
  FROM revenue_entries re
  WHERE re.status = 'confirmed' AND re.contract_id IS NOT NULL
  GROUP BY re.contract_id
),
contract_costs AS (
  SELECT ce.contract_id, SUM(ce.amount) AS total_costs
  FROM cost_entries ce WHERE ce.contract_id IS NOT NULL
  GROUP BY ce.contract_id
)
SELECT
  c.id AS contract_id, c.org_id, c.project_id, c.contract_no,
  c.title AS contract_title, c.client_name, c.contract_value,
  c.status AS contract_status, c.signed_date,
  p.code AS project_code, p.name AS project_name,
  COALESCE(cr.total_revenue, 0) AS total_revenue,
  COALESCE(cc.total_costs, 0) AS total_costs,
  COALESCE(cr.total_revenue, 0) - COALESCE(cc.total_costs, 0) AS profit,
  CASE WHEN c.contract_value > 0
    THEN ROUND(COALESCE(cr.total_revenue, 0) * 100.0 / c.contract_value, 1) ELSE 0
  END AS revenue_pct,
  CASE WHEN COALESCE(cr.total_revenue, 0) > 0
    THEN ROUND((COALESCE(cr.total_revenue, 0) - COALESCE(cc.total_costs, 0)) * 100.0 / COALESCE(cr.total_revenue, 0), 1) ELSE 0
  END AS margin_pct
FROM contracts c
JOIN projects p ON p.id = c.project_id
LEFT JOIN contract_revenue cr ON cr.contract_id = c.id
LEFT JOIN contract_costs cc ON cc.contract_id = c.id
WHERE c.deleted_at IS NULL
  AND p.deleted_at IS NULL;
