-- ============================================================================
-- KPI: soft-delete filter + indexes bổ sung
-- ============================================================================

-- ─── fn_allocate_smart: thêm deleted_at IS NULL cho tasks ───────────────────

CREATE OR REPLACE FUNCTION fn_allocate_smart(
  p_period_id UUID,
  p_use_actual BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
  v_period   RECORD;
  v_total_ws NUMERIC := 0;
  v_count    INT := 0;
  r          RECORD;
BEGIN
  SELECT ap.*, ac.weight_volume, ac.weight_quality, ac.weight_difficulty, ac.weight_ahead
  INTO v_period
  FROM allocation_periods ap
  JOIN allocation_configs ac ON ac.id = ap.config_id
  WHERE ap.id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Không tìm thấy đợt khoán');
  END IF;

  IF v_period.status IN ('approved', 'paid') THEN
    RETURN jsonb_build_object('error', 'Đợt khoán đã được duyệt, không thể tính lại');
  END IF;

  DELETE FROM allocation_results WHERE period_id = p_period_id;

  FOR r IN
    SELECT
      t.assignee_id AS user_id,
      COUNT(*)::INT AS task_count,
      AVG(COALESCE(CASE WHEN p_use_actual THEN t.actual_volume   ELSE t.expect_volume   END, 50))::NUMERIC(5,2) AS avg_vol,
      AVG(COALESCE(CASE WHEN p_use_actual THEN t.actual_quality  ELSE t.expect_quality  END, 50))::NUMERIC(5,2) AS avg_qual,
      AVG(COALESCE(CASE WHEN p_use_actual THEN t.actual_difficulty ELSE t.expect_difficulty END, 50))::NUMERIC(5,2) AS avg_diff,
      AVG(COALESCE(CASE WHEN p_use_actual THEN t.actual_ahead    ELSE t.expect_ahead    END, 50))::NUMERIC(5,2) AS avg_ahd,
      CASE
        WHEN v_period.mode = 'global' THEN
          COALESCE(AVG(COALESCE(ppf.difficulty_factor, 1.00)), 1.00)
        ELSE 1.00
      END::NUMERIC(4,2) AS avg_factor
    FROM tasks t
    JOIN users u ON u.id = t.assignee_id
    LEFT JOIN period_project_factors ppf
      ON ppf.project_id = t.project_id AND ppf.period_id = p_period_id
    WHERE t.org_id = v_period.org_id
      AND t.status = 'completed'
      AND t.deleted_at IS NULL
      AND t.assignee_id IS NOT NULL
      AND (
        (v_period.period_start IS NOT NULL AND v_period.period_end IS NOT NULL
         AND t.completed_at::DATE BETWEEN v_period.period_start AND v_period.period_end)
        OR (v_period.period_start IS NULL OR v_period.period_end IS NULL)
      )
      AND (v_period.center_id IS NULL OR u.center_id = v_period.center_id)
      AND (v_period.mode = 'global' OR (v_period.project_id IS NOT NULL AND t.project_id = v_period.project_id))
      AND (v_period.dept_id IS NULL OR t.dept_id = v_period.dept_id)
    GROUP BY t.assignee_id
  LOOP
    DECLARE
      ws NUMERIC(7,2);
      adjusted_ws NUMERIC(7,2);
    BEGIN
      ws := r.avg_vol  * v_period.weight_volume
          + r.avg_qual * v_period.weight_quality
          + r.avg_diff * v_period.weight_difficulty
          + r.avg_ahd  * v_period.weight_ahead;

      adjusted_ws := ws * r.avg_factor;

      INSERT INTO allocation_results (
        period_id, user_id, project_id, mode,
        avg_volume, avg_quality, avg_difficulty, avg_ahead,
        weighted_score, task_count, breakdown
      ) VALUES (
        p_period_id, r.user_id, v_period.project_id, v_period.mode,
        r.avg_vol, r.avg_qual, r.avg_diff, r.avg_ahd,
        adjusted_ws, r.task_count,
        jsonb_build_object(
          'volume', r.avg_vol, 'quality', r.avg_qual,
          'difficulty', r.avg_diff, 'ahead', r.avg_ahd,
          'raw_score', ws, 'difficulty_factor', r.avg_factor,
          'use_actual', p_use_actual
        )
      );

      v_total_ws := v_total_ws + adjusted_ws;
      v_count := v_count + 1;
    END;
  END LOOP;

  IF v_count = 0 THEN
    UPDATE allocation_periods SET status = 'calculated', updated_at = NOW() WHERE id = p_period_id;
    RETURN jsonb_build_object('status', 'calculated', 'user_count', 0, 'message', 'Không có task hoàn thành trong kỳ');
  END IF;

  UPDATE allocation_results
  SET share_percentage = CASE WHEN v_total_ws > 0 THEN (weighted_score / v_total_ws) ELSE 0 END,
      allocated_amount = CASE WHEN v_total_ws > 0 THEN ROUND((weighted_score / v_total_ws) * v_period.total_fund) ELSE 0 END,
      calculated_at = NOW()
  WHERE period_id = p_period_id;

  UPDATE allocation_periods SET status = 'calculated', updated_at = NOW() WHERE id = p_period_id;

  RETURN jsonb_build_object(
    'status', 'calculated',
    'period_id', p_period_id,
    'user_count', v_count,
    'total_weighted_score', ROUND(v_total_ws, 2),
    'total_fund', v_period.total_fund,
    'mode', v_period.mode,
    'center_id', v_period.center_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── INDEXES BỔ SUNG ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_alloc_results_period_user
  ON allocation_results (period_id, user_id);

CREATE INDEX IF NOT EXISTS idx_acceptance_rounds_allocation
  ON acceptance_rounds (allocation_id, sort_order);

SELECT '021_kpi_fixes: done' AS status;
