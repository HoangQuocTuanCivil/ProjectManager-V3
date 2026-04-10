-- ============================================================================
-- CROSS-MODULE INTEGRITY: Contracts ↔ Tasks ↔ KPI
-- #3  source_allocation_id column + FK
-- #4  fn_revenue_from_billing check deleted_at
-- #5  ON DELETE CASCADE cho source_allocation_id
-- ============================================================================

-- ─── #3 CRITICAL: source_allocation_id trên contracts ───────────────────────

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS source_allocation_id UUID
  REFERENCES dept_budget_allocations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_source_alloc
  ON contracts (source_allocation_id)
  WHERE source_allocation_id IS NOT NULL;

-- ─── #4 HIGH: fn_revenue_from_billing check contract deleted_at ─────────────

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
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM revenue_entries
    WHERE source = 'billing_milestone' AND source_id = NEW.id
  ) THEN RETURN NEW; END IF;

  SELECT c.id, c.org_id, c.project_id
    INTO v_contract
    FROM contracts c
   WHERE c.id = NEW.contract_id
     AND c.deleted_at IS NULL;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_creator_id := COALESCE(
    auth.uid(),
    (SELECT id FROM users
      WHERE org_id = v_contract.org_id AND role = 'admin' AND is_active = TRUE
      ORDER BY created_at LIMIT 1)
  );

  IF v_creator_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO revenue_entries (
    org_id, project_id, contract_id,
    dimension, method, source, source_id,
    amount, description,
    recognition_date, status,
    period_start, period_end,
    created_by
  ) VALUES (
    v_contract.org_id, v_contract.project_id, v_contract.id,
    'contract', 'acceptance', 'billing_milestone', NEW.id,
    NEW.amount, NEW.title,
    COALESCE(NEW.paid_date, CURRENT_DATE),
    'confirmed',
    NEW.paid_date, NEW.paid_date,
    v_creator_id
  )
  RETURNING id INTO v_new_entry_id;

  PERFORM fn_allocate_dept_revenue(v_new_entry_id);
  RETURN NEW;
END;
$$;

SELECT '022_cross_module_integrity: done' AS status;
