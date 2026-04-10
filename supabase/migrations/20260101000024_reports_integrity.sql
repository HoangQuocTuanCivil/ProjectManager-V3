-- ============================================================================
-- REPORTS INTEGRITY: view + trigger soft-delete filters
-- #1  v_contract_profitloss: filter deleted_at
-- #4  fn_revenue_adjustment: auto-confirm entry, check deleted_at
-- ============================================================================

-- ─── #1 v_contract_profitloss ───────────────────────────────────────────────

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

-- ─── #4 fn_revenue_adjustment: auto-confirm + deleted_at check ──────────────

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
  SELECT c.id, c.contract_value, c.project_id, c.org_id
    INTO v_contract
    FROM contracts c
   WHERE c.id = NEW.contract_id
     AND c.deleted_at IS NULL;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_new_value  := v_contract.contract_value + NEW.value_change;
  v_recog_date := COALESCE(NEW.signed_date, CURRENT_DATE);

  UPDATE contracts
     SET contract_value = v_new_value,
         end_date       = COALESCE(NEW.new_end_date, end_date),
         updated_at     = NOW()
   WHERE id = NEW.contract_id;

  UPDATE projects
     SET budget     = v_new_value,
         updated_at = NOW()
   WHERE id = v_contract.project_id;

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
      'contract', 'acceptance', 'manual', NEW.id,
      NEW.value_change,
      'Điều chỉnh PL ' || NEW.addendum_no,
      v_recog_date, 'confirmed',
      v_recog_date, v_recog_date,
      NEW.created_by
    )
    RETURNING id INTO v_new_entry_id;

    IF v_new_entry_id IS NOT NULL THEN
      PERFORM fn_allocate_dept_revenue(v_new_entry_id);
    END IF;
  END IF;

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

SELECT '024_reports_integrity: done' AS status;
