-- ============================================================================
-- CROSS-MODULE MEDIUM FIXES
-- #8  fn_evaluate_task_kpi: validate task tồn tại
-- #11 fn_revenue_from_acceptance: check task.deleted_at
-- ============================================================================

-- ─── #8 fn_evaluate_task_kpi ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_evaluate_task_kpi(
  p_task UUID,
  p_eval UUID,
  p_vol INT DEFAULT NULL,
  p_ahd INT DEFAULT NULL,
  p_qual INT DEFAULT 80,
  p_diff INT DEFAULT 50,
  p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE t RECORD; r JSONB;
BEGIN
  UPDATE tasks SET
    actual_volume = COALESCE(p_vol, actual_volume),
    actual_ahead = COALESCE(p_ahd, actual_ahead),
    actual_quality = p_qual,
    actual_difficulty = p_diff,
    kpi_evaluated_by = p_eval,
    kpi_evaluated_at = NOW(),
    kpi_note = p_note,
    status = 'completed'
  WHERE id = p_task
    AND deleted_at IS NULL
  RETURNING * INTO t;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Task không tồn tại hoặc đã bị xóa');
  END IF;

  r = jsonb_build_object(
    'task_id', t.id,
    'expect_score', t.expect_score,
    'actual_score', t.actual_score,
    'variance', t.kpi_variance,
    'verdict', CASE
      WHEN t.kpi_variance >= 10 THEN 'exceptional'
      WHEN t.kpi_variance >= 0 THEN 'exceeded'
      WHEN t.kpi_variance >= -10 THEN 'near'
      ELSE 'below'
    END
  );
  INSERT INTO audit_logs(org_id, user_id, action, resource_type, resource_id, new_values)
  VALUES(t.org_id, p_eval, 'approve', 'task_kpi', p_task, r);
  RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── #11 fn_revenue_from_acceptance: check deleted_at ───────────────────────

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
  IF NEW.kpi_evaluated_at IS NULL THEN RETURN NEW; END IF;
  IF (NEW.metadata->>'payment_status') IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  IF OLD.kpi_evaluated_at IS NOT NULL
     AND (OLD.metadata->>'payment_status') = 'paid'
  THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM revenue_entries
    WHERE source = 'acceptance' AND source_id = NEW.id
  ) THEN RETURN NEW; END IF;

  v_amount := (NEW.metadata->>'payment_amount')::numeric;
  IF COALESCE(v_amount, 0) = 0 THEN RETURN NEW; END IF;

  v_recog_date := COALESCE(
    (NEW.metadata->>'payment_date')::date,
    CURRENT_DATE
  );

  INSERT INTO revenue_entries (
    org_id, project_id, dept_id,
    dimension, method, source, source_id,
    amount, description,
    recognition_date, status,
    period_start, period_end,
    created_by
  ) VALUES (
    NEW.org_id, NEW.project_id, NEW.dept_id,
    'project', 'acceptance', 'acceptance', NEW.id,
    v_amount, NEW.title,
    v_recog_date, 'confirmed',
    v_recog_date, v_recog_date,
    COALESCE(NEW.kpi_evaluated_by, NEW.assigner_id)
  );

  RETURN NEW;
END;
$$;

SELECT '023_cross_module_medium: done' AS status;
