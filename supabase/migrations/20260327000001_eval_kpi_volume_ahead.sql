-- Migration: Update fn_evaluate_task_kpi to accept volume and ahead params

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
  WHERE id = p_task RETURNING * INTO t;
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
