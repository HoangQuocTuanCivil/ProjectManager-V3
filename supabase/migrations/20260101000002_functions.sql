-- ============================================================================
-- A2Z WORKHUB — FUNCTIONS & TRIGGERS (Consolidated)
-- Tất cả functions và triggers phiên bản cuối cùng, mỗi hàm xuất hiện 1 lần.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTH HELPERS
-- Các hàm lấy thông tin user hiện tại, SECURITY DEFINER để bypass RLS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Lấy org_id user hiện tại
CREATE OR REPLACE FUNCTION public.user_org_id() RETURNS UUID AS $$
  SELECT org_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Lấy dept_id user hiện tại
CREATE OR REPLACE FUNCTION public.user_dept_id() RETURNS UUID AS $$
  SELECT dept_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Lấy role user hiện tại
CREATE OR REPLACE FUNCTION public.user_role() RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Lấy center_id user hiện tại
CREATE OR REPLACE FUNCTION public.user_center_id() RETURNS UUID AS $$
  SELECT center_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Lấy team_id user hiện tại
CREATE OR REPLACE FUNCTION public.user_team_id() RETURNS UUID AS $$
  SELECT team_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Kiểm tra user thuộc phòng ban executive (Ban điều hành)
CREATE OR REPLACE FUNCTION public.user_is_executive() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT d.is_executive FROM departments d
     JOIN users u ON u.dept_id = d.id
     WHERE u.id = auth.uid()),
    false
  );
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- UTILITY
-- Hàm tiện ích dùng chung
-- ═══════════════════════════════════════════════════════════════════════════════

-- Tự động cập nhật cột updated_at khi row bị sửa
CREATE OR REPLACE FUNCTION fn_update_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Đồng bộ actual_hours từ bảng time_entries vào tasks
CREATE OR REPLACE FUNCTION fn_sync_hours() RETURNS TRIGGER AS $$
BEGIN
  UPDATE tasks SET actual_hours=(SELECT ROUND(SUM(duration_minutes)::NUMERIC/60,1) FROM time_entries WHERE task_id=COALESCE(NEW.task_id,OLD.task_id))
  WHERE id=COALESCE(NEW.task_id,OLD.task_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Lấy cài đặt tổ chức theo category và key
CREATE OR REPLACE FUNCTION fn_get_setting(p_org UUID, p_cat TEXT, p_key TEXT) RETURNS JSONB AS $$
  SELECT value FROM org_settings WHERE org_id=p_org AND category=p_cat AND key=p_key;
$$ LANGUAGE SQL STABLE;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TASK SCORING & STATUS
-- Tự chấm điểm KPI task và ghi log đổi trạng thái
-- ═══════════════════════════════════════════════════════════════════════════════

-- Tự động tính actual_volume (= progress) và actual_ahead (dựa trên deadline)
CREATE OR REPLACE FUNCTION fn_auto_score_task() RETURNS TRIGGER AS $$
DECLARE v INT;
BEGIN
  NEW.actual_volume = NEW.progress;
  IF NEW.status = 'completed' AND NEW.deadline IS NOT NULL THEN
    v = NEW.deadline - COALESCE(NEW.completed_at::DATE, CURRENT_DATE);
    NEW.actual_ahead = CASE WHEN v>0 THEN LEAST(50+v*5,100) WHEN v=0 THEN 50 ELSE GREATEST(50+v*10,0) END;
  ELSIF NEW.status IN ('in_progress','review') AND NEW.deadline IS NOT NULL AND NEW.start_date IS NOT NULL THEN
    DECLARE td INT := GREATEST(NEW.deadline-NEW.start_date,1); ep NUMERIC := (CURRENT_DATE-NEW.start_date)::NUMERIC/td*100;
    BEGIN
      NEW.actual_ahead = CASE WHEN NEW.progress>=ep THEN LEAST(50+((NEW.progress-ep)*0.5)::INT,80) ELSE GREATEST(50-((ep-NEW.progress)*0.5)::INT,10) END;
    END;
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.expect_volume = COALESCE(NEW.expect_volume,100);
    NEW.expect_quality = COALESCE(NEW.expect_quality,80);
    NEW.expect_difficulty = COALESCE(NEW.expect_difficulty,50);
    NEW.expect_ahead = COALESCE(NEW.expect_ahead,50);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tính expect/actual score theo trọng số trung tâm của assignee
CREATE OR REPLACE FUNCTION fn_calc_kpi_scores() RETURNS TRIGGER AS $$
DECLARE
  w_vol  NUMERIC := 0.40;
  w_qual NUMERIC := 0.30;
  w_diff NUMERIC := 0.20;
  w_ahd  NUMERIC := 0.10;
  v_center_id UUID;
BEGIN
  -- Lấy center_id từ assignee
  IF NEW.assignee_id IS NOT NULL THEN
    SELECT center_id INTO v_center_id
    FROM users WHERE id = NEW.assignee_id;

    -- Tra cứu trọng số theo trung tâm, fallback về config toàn công ty
    IF v_center_id IS NOT NULL THEN
      SELECT weight_volume, weight_quality, weight_difficulty, weight_ahead
      INTO w_vol, w_qual, w_diff, w_ahd
      FROM allocation_configs
      WHERE org_id = NEW.org_id AND center_id = v_center_id AND is_active = true
      LIMIT 1;
    END IF;

    -- Không có config riêng → fallback config toàn công ty
    IF NOT FOUND OR v_center_id IS NULL THEN
      SELECT weight_volume, weight_quality, weight_difficulty, weight_ahead
      INTO w_vol, w_qual, w_diff, w_ahd
      FROM allocation_configs
      WHERE org_id = NEW.org_id AND center_id IS NULL AND is_active = true
      LIMIT 1;
    END IF;
  END IF;

  -- Tính score từ trọng số
  NEW.expect_score := ROUND(
    COALESCE(NEW.expect_volume,0) * w_vol
    + COALESCE(NEW.expect_quality,0) * w_qual
    + COALESCE(NEW.expect_difficulty,0) * w_diff
    + COALESCE(NEW.expect_ahead,0) * w_ahd, 2);

  NEW.actual_score := ROUND(
    COALESCE(NEW.actual_volume,0) * w_vol
    + COALESCE(NEW.actual_quality,0) * w_qual
    + COALESCE(NEW.actual_difficulty,0) * w_diff
    + COALESCE(NEW.actual_ahead,0) * w_ahd, 2);

  NEW.kpi_variance := NEW.actual_score - NEW.expect_score;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ghi log khi task đổi trạng thái, tự set completed_at khi hoàn thành
CREATE OR REPLACE FUNCTION fn_log_status_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_status_logs(task_id,changed_by,old_status,new_status)
    VALUES(NEW.id,COALESCE(auth.uid(),NEW.assigner_id),OLD.status,NEW.status);
  END IF;
  IF NEW.status='completed' AND OLD.status!='completed' THEN
    NEW.completed_at=NOW(); NEW.progress=100;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- KPI EVALUATION & ALLOCATION
-- Nghiệm thu KPI và phân bổ khoán thông minh
-- ═══════════════════════════════════════════════════════════════════════════════

-- Nghiệm thu KPI task: chấm điểm, có kiểm tra deleted_at + error return
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

-- Tính khoán thông minh: KPI trung bình → chia quỹ theo weighted score
-- Có deleted_at IS NULL, period_project_factors thay vì project_dept_factors
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


-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- Gửi thông báo khi task thay đổi trạng thái, comment mới
-- ═══════════════════════════════════════════════════════════════════════════════

-- Thông báo khi task được giao hoặc đổi assignee (có task_id column)
CREATE OR REPLACE FUNCTION fn_notify_task_kpi() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id) THEN
    INSERT INTO notifications (org_id, user_id, title, body, type, task_id, data)
    VALUES (
      NEW.org_id, NEW.assignee_id,
      'Bạn được giao công việc mới',
      LEFT(NEW.title, 120),
      'task_assigned',
      NEW.id,
      jsonb_build_object('task_id', NEW.id, 'assigner_id', NEW.assigner_id,
        'kpi_weight', COALESCE(NEW.kpi_weight,1), 'expect_score', COALESCE(NEW.expect_score,0))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thông báo người giao khi task chuyển sang trạng thái chờ duyệt
CREATE OR REPLACE FUNCTION fn_notify_review() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'review' AND (OLD.status IS DISTINCT FROM 'review') AND NEW.assigner_id IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, title, body, type, task_id, data)
    VALUES (
      NEW.org_id, NEW.assigner_id,
      'Công việc chờ duyệt',
      LEFT(NEW.title, 120),
      'workflow_pending',
      NEW.id,
      jsonb_build_object('task_id', NEW.id, 'assignee_id', NEW.assignee_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thông báo assignee khi task được nghiệm thu (completed)
CREATE OR REPLACE FUNCTION fn_notify_completed() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> COALESCE(NEW.assigner_id, NEW.assignee_id) THEN
    INSERT INTO notifications (org_id, user_id, title, body, type, task_id, data)
    VALUES (
      NEW.org_id, NEW.assignee_id,
      'Công việc đã nghiệm thu',
      LEFT(NEW.title, 120),
      'kpi_evaluated',
      NEW.id,
      jsonb_build_object('task_id', NEW.id,
        'actual_score', COALESCE(NEW.actual_score,0),
        'expect_score', COALESCE(NEW.expect_score,0),
        'kpi_variance', COALESCE(NEW.kpi_variance,0))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thông báo assignee khi task bị trả lại từ review → in_progress
CREATE OR REPLACE FUNCTION fn_notify_revision() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'review' AND NEW.status = 'in_progress'
     AND NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> COALESCE(NEW.assigner_id, NEW.assignee_id) THEN
    INSERT INTO notifications (org_id, user_id, title, body, type, task_id, data)
    VALUES (
      NEW.org_id, NEW.assignee_id,
      'Công việc cần chỉnh sửa',
      LEFT(NEW.title, 120),
      'task_assigned',
      NEW.id,
      jsonb_build_object('task_id', NEW.id, 'assigner_id', NEW.assigner_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thông báo assignee/assigner khi có comment mới trên task
CREATE OR REPLACE FUNCTION fn_notify_task_comment() RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
BEGIN
  SELECT org_id, assignee_id, assigner_id, title
  INTO v_task
  FROM tasks WHERE id = NEW.task_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Notify assignee nếu commenter không phải assignee
  IF v_task.assignee_id IS NOT NULL AND v_task.assignee_id <> NEW.user_id THEN
    INSERT INTO notifications (org_id, user_id, title, body, type, task_id, data)
    VALUES (
      v_task.org_id,
      v_task.assignee_id,
      'Bình luận mới trong công việc',
      LEFT(NEW.content, 120),
      'task_comment',
      NEW.task_id,
      jsonb_build_object('task_id', NEW.task_id, 'comment_id', NEW.id, 'task_title', v_task.title)
    );
  END IF;

  -- Notify assigner nếu khác assignee và commenter
  IF v_task.assigner_id IS NOT NULL
     AND v_task.assigner_id <> NEW.user_id
     AND v_task.assigner_id IS DISTINCT FROM v_task.assignee_id THEN
    INSERT INTO notifications (org_id, user_id, title, body, type, task_id, data)
    VALUES (
      v_task.org_id,
      v_task.assigner_id,
      'Bình luận mới trong công việc',
      LEFT(NEW.content, 120),
      'task_comment',
      NEW.task_id,
      jsonb_build_object('task_id', NEW.task_id, 'comment_id', NEW.id, 'task_title', v_task.title)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TASK AUTOMATION & WORKFLOW
-- Tự động chuyển trạng thái và advance workflow
-- ═══════════════════════════════════════════════════════════════════════════════

-- Tự động chuyển status → review khi progress đạt 100%
CREATE OR REPLACE FUNCTION fn_task_before_progress() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.progress = 100 AND OLD.progress < 100 THEN
    IF NEW.status IN ('pending', 'in_progress') THEN
      NEW.status := 'review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tự động advance workflow khi progress đạt 100% và đang ở bước execute
CREATE OR REPLACE FUNCTION fn_task_after_progress_workflow() RETURNS TRIGGER AS $$
DECLARE
  v_step_type workflow_step_type;
BEGIN
  IF NEW.progress = 100 AND OLD.progress < 100 THEN
    SELECT ws.step_type INTO v_step_type
    FROM task_workflow_state tws
    JOIN workflow_steps ws ON tws.current_step_id = ws.id
    WHERE tws.task_id = NEW.id AND tws.completed_at IS NULL;

    IF FOUND AND v_step_type = 'execute' THEN
      PERFORM fn_workflow_advance(
        NEW.id,
        COALESCE(NEW.assignee_id, NEW.assigner_id),
        'completed',
        'Tự động hoàn thành bước thực hiện (Tiến độ 100%)'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Chuyển bước workflow: ghi lịch sử, gán assignee bước tiếp, gửi thông báo
CREATE OR REPLACE FUNCTION fn_workflow_advance(
  p_task UUID, p_actor UUID, p_result TEXT DEFAULT 'completed', p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  st RECORD;
  nx UUID;
  ns RECORD;
  cond TEXT;
  v_task RECORD;
  v_next_assignee UUID;
BEGIN
  -- Lấy trạng thái workflow hiện tại
  SELECT * INTO st FROM task_workflow_state WHERE task_id = p_task;
  IF NOT FOUND THEN RETURN '{"error":"no state"}'::JSONB; END IF;

  -- Ghi lịch sử bước hiện tại
  INSERT INTO workflow_history(task_id, step_id, action, actor_id, note)
  VALUES (p_task, st.current_step_id, p_result, p_actor, p_note);

  -- Đánh dấu bước hiện tại hoàn thành
  UPDATE task_workflow_state
  SET completed_at = NOW(), completed_by = p_actor, result = p_result
  WHERE task_id = p_task;

  -- Tìm transition sang bước tiếp theo
  SELECT wt.to_step_id, wt.condition_type INTO nx, cond
  FROM workflow_transitions wt
  WHERE wt.from_step_id = st.current_step_id
    AND (
      wt.condition_type = 'always'
      OR (wt.condition_type = 'if_approved' AND p_result = 'approved')
      OR (wt.condition_type = 'if_rejected' AND p_result = 'rejected')
    )
  LIMIT 1;

  IF nx IS NOT NULL THEN
    SELECT * INTO ns FROM workflow_steps WHERE id = nx;

    -- Chuyển sang bước tiếp theo
    UPDATE task_workflow_state
    SET current_step_id = nx, entered_at = NOW(),
        completed_at = NULL, completed_by = NULL, result = NULL
    WHERE task_id = p_task;

    INSERT INTO workflow_history(task_id, step_id, action, actor_id)
    VALUES (p_task, nx, 'entered', p_actor);

    -- Gán assignee_id cho bước tiếp theo từ metadata.step_assignees
    SELECT * INTO v_task FROM tasks WHERE id = p_task;
    v_next_assignee := (v_task.metadata -> 'step_assignees' ->> nx::TEXT)::UUID;

    IF v_next_assignee IS NOT NULL THEN
      UPDATE tasks SET assignee_id = v_next_assignee WHERE id = p_task;

      -- Thông báo cho người phụ trách bước mới
      INSERT INTO notifications(org_id, user_id, title, body, type, data)
      VALUES (
        v_task.org_id,
        v_next_assignee,
        format('Quy trình: bước "%s" cần xử lý', ns.name),
        format('CV: %s — Bạn được phân công xử lý bước "%s"', v_task.title, ns.name),
        'workflow_pending',
        jsonb_build_object('task_id', p_task, 'step_id', nx, 'step_name', ns.name)
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'advanced', 'to_step', nx,
      'step_name', ns.name, 'auto', ns.is_automatic,
      'assignee_id', v_next_assignee
    );
  END IF;

  RETURN jsonb_build_object('status', 'workflow_completed', 'task_id', p_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PERMISSIONS
-- Kiểm tra quyền user theo role hoặc custom_role
-- ═══════════════════════════════════════════════════════════════════════════════

-- Kiểm tra quyền: admin → full, custom_role → role_permissions, khác → cố định
CREATE OR REPLACE FUNCTION fn_has_permission(p_user UUID, p_perm TEXT) RETURNS BOOLEAN AS $$
DECLARE v_role user_role; v_cr UUID;
BEGIN
  SELECT role, custom_role_id INTO v_role, v_cr FROM users WHERE id = p_user;
  IF v_role = 'admin' THEN RETURN TRUE; END IF;
  IF v_cr IS NOT NULL THEN
    RETURN EXISTS(SELECT 1 FROM role_permissions WHERE role_id = v_cr AND permission_id = p_perm);
  END IF;
  RETURN CASE v_role
    WHEN 'leader' THEN p_perm NOT IN ('settings.security')
    WHEN 'director' THEN p_perm IN (
      'task.view_all','task.view_dept','task.create','task.edit_others','task.update_progress',
      'task.score_kpi','task.approve','task.delete',
      'project.view_all','project.edit','project.manage_members','project.create',
      'kpi.view_company','kpi.view_dept','kpi.view_self','kpi.config','kpi.create_period',
      'settings.users','settings.depts','settings.templates','settings.workflows',
      'goals.create','goals.view_all','goals.manage'
    )
    WHEN 'head' THEN p_perm IN (
      'task.view_dept','task.create','task.edit_others','task.update_progress',
      'task.score_kpi','task.approve',
      'project.view_all','project.edit','project.manage_members',
      'kpi.view_dept','kpi.view_self',
      'settings.templates',
      'goals.create','goals.view_all'
    )
    WHEN 'team_leader' THEN p_perm IN (
      'task.view_team','task.create','task.edit_others','task.update_progress',
      'project.view_all',
      'kpi.view_self',
      'goals.create'
    )
    WHEN 'staff' THEN p_perm IN (
      'task.view_self','task.update_progress','kpi.view_self'
    )
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════════════════════════
-- USER MANAGEMENT
-- Tự tạo profile khi user đăng ký qua auth
-- ═══════════════════════════════════════════════════════════════════════════════

-- Tự tạo profile trong public.users khi có user mới đăng ký
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  INSERT INTO public.users (id, org_id, email, full_name, role, is_active)
  VALUES (NEW.id, v_org_id, NEW.email, v_full_name, 'staff', TRUE)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════════════
-- REVENUE & COST
-- Ghi nhận doanh thu từ thanh toán, nghiệm thu, phụ lục và phân bổ phòng ban
-- ═══════════════════════════════════════════════════════════════════════════════

-- Phân bổ doanh thu cho các phòng ban (có validation + xử lý khi project chưa có PB)
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
  v_dept_exists BOOLEAN;
BEGIN
  -- Lấy revenue entry cần phân bổ
  SELECT id, amount, project_id, org_id
    INTO v_entry
    FROM revenue_entries
   WHERE id = p_entry_id;

  IF NOT FOUND OR v_entry.project_id IS NULL THEN
    RETURN;
  END IF;

  -- Kiểm tra project có phòng ban nào không
  SELECT EXISTS (
    SELECT 1 FROM project_departments WHERE project_id = v_entry.project_id
  ) INTO v_dept_exists;

  IF NOT v_dept_exists THEN
    -- Revert về draft, chờ khi phòng ban được thêm sẽ tự phân bổ lại
    UPDATE revenue_entries
       SET status     = 'draft',
           notes      = COALESCE(notes, '') ||
                        E'\n[Chờ phân bổ: project chưa có phòng ban — ' ||
                        TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI') || ']',
           updated_at = NOW()
     WHERE id = v_entry.id
       AND status = 'confirmed';

    INSERT INTO audit_logs (org_id, user_id, action, resource_type, resource_id, new_values)
    VALUES (
      v_entry.org_id,
      auth.uid(),
      'update',
      'revenue_entry',
      v_entry.id,
      jsonb_build_object(
        'trigger', 'allocate_dept_revenue_no_departments',
        'project_id', v_entry.project_id,
        'amount', v_entry.amount,
        'action_taken', 'reverted_to_draft',
        'resolution', 'auto_retry_when_dept_added'
      )
    );

    RETURN;
  END IF;

  -- Xoá allocation cũ để tính lại
  DELETE FROM dept_revenue_allocations
   WHERE revenue_entry_id = v_entry.id;

  -- Phân bổ theo trọng số giao khoán hoặc chia đều
  FOR v_alloc IN
    WITH budget_depts AS (
      SELECT dba.dept_id, dba.allocated_amount AS budget
      FROM dept_budget_allocations dba
      WHERE dba.project_id = v_entry.project_id AND dba.dept_id IS NOT NULL
      UNION ALL
      SELECT dep.id AS dept_id,
        ROUND(dba.allocated_amount::NUMERIC / GREATEST(
          (SELECT COUNT(*) FROM departments d2 WHERE d2.center_id = dba.center_id AND d2.is_active), 1
        )) AS budget
      FROM dept_budget_allocations dba
      JOIN departments dep ON dep.center_id = dba.center_id AND dep.is_active = TRUE
      WHERE dba.project_id = v_entry.project_id AND dba.center_id IS NOT NULL AND dba.dept_id IS NULL
    ),
    depts AS (
      SELECT
        COALESCE(bd.dept_id, pd.dept_id) AS dept_id,
        COALESCE(bd.budget, 0)                             AS budget,
        COUNT(*) OVER ()                                   AS dept_count,
        SUM(COALESCE(bd.budget, 0)) OVER ()                AS budget_total,
        ROW_NUMBER() OVER (
          ORDER BY COALESCE(bd.budget, 0) DESC, COALESCE(bd.dept_id, pd.dept_id)
        ) AS rn
      FROM project_departments pd
      LEFT JOIN budget_depts bd ON bd.dept_id = pd.dept_id
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
    -- Phòng ban cuối nhận phần dư để tổng khớp chính xác
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

    IF v_alloc.pct > v_top_pct THEN
      v_top_pct  := v_alloc.pct;
      v_top_dept := v_alloc.dept_id;
    END IF;
  END LOOP;

  -- Gán phòng ban tỷ lệ cao nhất làm PB chính trên revenue entry
  IF v_top_dept IS NOT NULL THEN
    UPDATE revenue_entries SET dept_id = v_top_dept WHERE id = v_entry.id;
  END IF;
END;
$$;

-- Ghi nhận doanh thu từ thanh toán milestone (có kiểm tra deleted_at hợp đồng)
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

-- Ghi nhận doanh thu từ nghiệm thu task (có audit log + EXCEPTION block)
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
  -- Điều kiện: task đã đánh giá KPI và xác nhận thanh toán
  IF NEW.kpi_evaluated_at IS NULL THEN RETURN NEW; END IF;
  IF (NEW.metadata->>'payment_status') IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  -- Chống trùng: không phải lần đầu chuyển trạng thái
  IF OLD.kpi_evaluated_at IS NOT NULL
     AND (OLD.metadata->>'payment_status') = 'paid'
  THEN
    RETURN NEW;
  END IF;

  -- Idempotent: task đã có revenue entry
  IF EXISTS (
    SELECT 1 FROM revenue_entries
    WHERE source = 'acceptance' AND source_id = NEW.id
  ) THEN RETURN NEW; END IF;

  -- Parse payment_amount an toàn
  BEGIN
    v_amount := (NEW.metadata->>'payment_amount')::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_amount := NULL;
  END;

  IF COALESCE(v_amount, 0) = 0 THEN
    -- Ghi audit log khi thiếu payment_amount
    INSERT INTO audit_logs (org_id, user_id, action, resource_type, resource_id, new_values)
    VALUES (
      NEW.org_id,
      COALESCE(auth.uid(), NEW.kpi_evaluated_by, NEW.assigner_id),
      'update',
      'task',
      NEW.id,
      jsonb_build_object(
        'trigger', 'revenue_from_acceptance_skipped',
        'reason', CASE
          WHEN NEW.metadata->>'payment_amount' IS NULL THEN 'payment_amount not set in metadata'
          ELSE 'payment_amount is zero or invalid: ' || COALESCE(NEW.metadata->>'payment_amount', 'null')
        END,
        'task_title', NEW.title,
        'project_id', NEW.project_id
      )
    );
    RETURN NEW;
  END IF;

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

-- Điều chỉnh doanh thu khi tạo phụ lục hợp đồng (auto-confirm + deleted_at check)
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
     SET budget = (
           SELECT COALESCE(SUM(contract_value), 0)
           FROM contracts
           WHERE project_id = v_contract.project_id
             AND contract_type = 'outgoing'
             AND deleted_at IS NULL
         ),
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

-- Tính quỹ khoán thực tế cho 1 phòng ban trong 1 kỳ
CREATE OR REPLACE FUNCTION fn_calc_actual_fund(p_dept_id UUID, p_start DATE, p_end DATE)
RETURNS TABLE (
  dept_id UUID, revenue_allocated NUMERIC(15,0), avg_factor NUMERIC(4,2),
  adjusted_revenue NUMERIC(15,0), total_costs NUMERIC(15,0),
  internal_rev NUMERIC(15,0), actual_fund NUMERIC(15,0)
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_revenue NUMERIC(15,0); v_factor NUMERIC(4,2);
  v_adj_rev NUMERIC(15,0); v_costs NUMERIC(15,0); v_internal NUMERIC(15,0);
BEGIN
  SELECT COALESCE(SUM(dra.allocated_amount), 0) INTO v_revenue
    FROM dept_revenue_allocations dra
    JOIN revenue_entries re ON re.id = dra.revenue_entry_id
   WHERE dra.dept_id = p_dept_id AND re.status = 'confirmed'
     AND re.recognition_date BETWEEN p_start AND p_end;

  SELECT COALESCE(AVG(pdf.difficulty_factor), 1.00) INTO v_factor
    FROM project_dept_factors pdf
   WHERE pdf.dept_id = p_dept_id AND pdf.project_id IN (
     SELECT DISTINCT dra.project_id FROM dept_revenue_allocations dra
     JOIN revenue_entries re ON re.id = dra.revenue_entry_id
     WHERE dra.dept_id = p_dept_id AND re.status = 'confirmed'
       AND re.recognition_date BETWEEN p_start AND p_end AND dra.project_id IS NOT NULL);

  v_adj_rev := ROUND(v_revenue * v_factor);

  SELECT COALESCE(SUM(ce.amount), 0) INTO v_costs
    FROM cost_entries ce
   WHERE ce.dept_id = p_dept_id AND ce.period_start IS NOT NULL
     AND ce.period_start <= p_end AND COALESCE(ce.period_end, ce.period_start) >= p_start;

  SELECT COALESCE(SUM(ir.total_amount), 0) INTO v_internal
    FROM internal_revenue ir
   WHERE ir.dept_id = p_dept_id AND ir.status = 'approved' AND ir.period_start IS NOT NULL
     AND ir.period_start <= p_end AND COALESCE(ir.period_end, ir.period_start) >= p_start;

  RETURN QUERY SELECT p_dept_id, v_revenue, v_factor, v_adj_rev, v_costs, v_internal,
    v_adj_rev - v_costs + v_internal;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- BONUS & SALARY
-- Tính thưởng khoán, khấu trừ lương, rollback phụ lục
-- ═══════════════════════════════════════════════════════════════════════════════

-- Tính thưởng khoán cho 1 đợt (có salary warning khi thiếu bản ghi lương)
CREATE OR REPLACE FUNCTION fn_calc_bonus(p_period_id UUID)
RETURNS TABLE (
  user_id UUID, allocated_amount NUMERIC(15,0), total_salary NUMERIC(15,0),
  bonus NUMERIC(15,0), has_deduction BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period RECORD; v_result RECORD;
  v_total_salary NUMERIC(15,0); v_bonus NUMERIC(15,0);
  v_deduction_id UUID; v_monthly NUMERIC(15,0);
BEGIN
  SELECT id, org_id, period_start, period_end INTO v_period
    FROM allocation_periods WHERE id = p_period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Allocation period % not found', p_period_id; END IF;

  FOR v_result IN
    SELECT ar.id, ar.user_id, COALESCE(ar.allocated_amount, 0) AS alloc_amt
    FROM allocation_results ar WHERE ar.period_id = p_period_id
  LOOP
    -- Tổng lương đã trả trong kỳ
    SELECT COALESCE(SUM(sr.base_salary), 0) INTO v_total_salary
      FROM salary_records sr
     WHERE sr.user_id = v_result.user_id
       AND sr.month >= v_period.period_start AND sr.month <= v_period.period_end;

    -- Warning khi user có allocation nhưng không có bản ghi lương
    IF v_total_salary = 0 AND v_result.alloc_amt > 0 THEN
      INSERT INTO audit_logs (org_id, user_id, action, resource_type, resource_id, new_values)
      VALUES (
        v_period.org_id,
        v_result.user_id,
        'update',
        'allocation_result',
        v_result.id,
        jsonb_build_object(
          'trigger', 'calc_bonus_no_salary_records',
          'period_id', p_period_id,
          'period_range', v_period.period_start || ' → ' || v_period.period_end,
          'allocated_amount', v_result.alloc_amt,
          'warning', 'Không tìm thấy salary_records — bonus có thể bị sai'
        )
      );
    END IF;

    v_bonus := v_result.alloc_amt - v_total_salary;
    v_deduction_id := NULL;

    -- Khoán âm: tạo lịch khấu trừ chia đều 3 kỳ lương tiếp theo
    IF v_bonus < 0 THEN
      v_monthly := GREATEST(ROUND(ABS(v_bonus) / 3.0), 1);
      INSERT INTO salary_deductions (
        org_id, user_id, period_id, total_amount, remaining_amount, monthly_deduction, status, reason
      ) VALUES (
        v_period.org_id, v_result.user_id, p_period_id,
        ABS(v_bonus), ABS(v_bonus), v_monthly, 'active',
        'Khoán âm kỳ ' || v_period.period_start || ' → ' || v_period.period_end
      )
      ON CONFLICT (user_id, period_id) DO UPDATE SET
        total_amount = ABS(v_bonus), remaining_amount = ABS(v_bonus),
        monthly_deduction = GREATEST(ROUND(ABS(v_bonus) / 3.0), 1),
        status = 'active', updated_at = NOW()
      RETURNING id INTO v_deduction_id;
    END IF;

    UPDATE allocation_results SET total_salary_paid = v_total_salary,
      bonus_amount = GREATEST(v_bonus, 0), deduction_id = v_deduction_id
    WHERE id = v_result.id;

    RETURN QUERY SELECT v_result.user_id, v_result.alloc_amt, v_total_salary,
      v_bonus, v_deduction_id IS NOT NULL;
  END LOOP;
END;
$$;

-- Tự động khấu trừ khi nhập lương mới
CREATE OR REPLACE FUNCTION fn_apply_deductions()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ded RECORD; v_apply NUMERIC(15,0); v_total_applied NUMERIC(15,0) := 0;
BEGIN
  FOR v_ded IN
    SELECT id, remaining_amount, monthly_deduction FROM salary_deductions
    WHERE user_id = NEW.user_id AND status = 'active' AND remaining_amount > 0
    ORDER BY created_at ASC
  LOOP
    v_apply := LEAST(v_ded.monthly_deduction, v_ded.remaining_amount);
    UPDATE salary_deductions SET remaining_amount = remaining_amount - v_apply,
      status = CASE WHEN remaining_amount - v_apply <= 0 THEN 'completed' ELSE status END
    WHERE id = v_ded.id;
    v_total_applied := v_total_applied + v_apply;
  END LOOP;
  IF v_total_applied > 0 THEN NEW.deduction_applied := v_total_applied; END IF;
  RETURN NEW;
END;
$$;

-- Rollback phụ lục giảm giá trị: tạo salary_deductions cho NV bị ảnh hưởng
CREATE OR REPLACE FUNCTION fn_handle_addendum_rollback()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_contract RECORD; v_dept RECORD; v_impact NUMERIC(15,0);
  v_period RECORD; v_user_share NUMERIC(15,0); v_result RECORD;
BEGIN
  IF NEW.value_change >= 0 THEN RETURN NEW; END IF;

  SELECT c.id, c.org_id, c.project_id INTO v_contract FROM contracts c WHERE c.id = NEW.contract_id;
  IF NOT FOUND OR v_contract.project_id IS NULL THEN RETURN NEW; END IF;

  FOR v_dept IN
    WITH dept_shares AS (
      SELECT pd.dept_id, COALESCE(dba.allocated_amount, 0) AS budget,
        SUM(COALESCE(dba.allocated_amount, 0)) OVER () AS total, COUNT(*) OVER () AS dept_count
      FROM project_departments pd
      LEFT JOIN dept_budget_allocations dba ON dba.project_id = pd.project_id AND dba.dept_id = pd.dept_id
      WHERE pd.project_id = v_contract.project_id
    )
    SELECT dept_id,
      CASE WHEN total > 0 THEN ROUND(ABS(NEW.value_change) * budget / total)
        ELSE ROUND(ABS(NEW.value_change)::NUMERIC / dept_count) END AS impact_amount
    FROM dept_shares
  LOOP
    v_impact := v_dept.impact_amount;
    IF v_impact <= 0 THEN CONTINUE; END IF;

    SELECT ap.id, ap.period_start, ap.period_end, ap.org_id INTO v_period
      FROM allocation_periods ap
     WHERE ap.status = 'paid' AND (ap.project_id = v_contract.project_id OR ap.project_id IS NULL)
       AND ap.org_id = v_contract.org_id ORDER BY ap.period_end DESC LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;

    FOR v_result IN
      SELECT ar.id, ar.user_id, ar.allocated_amount, ar.share_percentage
      FROM allocation_results ar JOIN users u ON u.id = ar.user_id AND u.dept_id = v_dept.dept_id
      WHERE ar.period_id = v_period.id AND COALESCE(ar.allocated_amount, 0) > 0
    LOOP
      v_user_share := GREATEST(ROUND(v_impact * v_result.share_percentage), 1);
      INSERT INTO salary_deductions (
        org_id, user_id, period_id, total_amount, remaining_amount, monthly_deduction, status, reason
      ) VALUES (
        v_contract.org_id, v_result.user_id, v_period.id,
        v_user_share, v_user_share, GREATEST(ROUND(v_user_share / 3.0), 1), 'active',
        'Rollback PL ' || NEW.addendum_no || ' giảm ' || ABS(NEW.value_change)
      )
      ON CONFLICT (user_id, period_id) DO UPDATE SET
        total_amount = salary_deductions.total_amount + v_user_share,
        remaining_amount = salary_deductions.remaining_amount + v_user_share,
        monthly_deduction = GREATEST(ROUND((salary_deductions.total_amount + v_user_share) / 3.0), 1),
        reason = salary_deductions.reason || '; PL ' || NEW.addendum_no, updated_at = NOW();
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TASK SOFT-DELETE CASCADE
-- Khi task bị soft-delete, cancel revenue_entries liên kết
-- ═══════════════════════════════════════════════════════════════════════════════

-- Cancel revenue entries khi task bị soft-delete
CREATE OR REPLACE FUNCTION fn_cascade_task_soft_delete_to_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled INT;
BEGIN
  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE revenue_entries
     SET status     = 'cancelled',
         notes      = COALESCE(notes, '') ||
                      E'\n[Auto-cancelled: task soft-deleted ' ||
                      TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI') || ']',
         updated_at = NOW()
   WHERE source     = 'acceptance'
     AND source_id  = NEW.id
     AND status    <> 'cancelled';

  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  IF v_cancelled > 0 THEN
    INSERT INTO audit_logs (org_id, user_id, action, resource_type, resource_id, new_values)
    VALUES (
      NEW.org_id,
      COALESCE(auth.uid(), NEW.assigner_id),
      'update',
      'revenue_entry',
      NEW.id,
      jsonb_build_object(
        'trigger', 'task_soft_delete_cascade',
        'task_id', NEW.id,
        'revenue_entries_cancelled', v_cancelled
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Auto-retry phân bổ revenue khi phòng ban được thêm vào project
CREATE OR REPLACE FUNCTION fn_retry_unallocated_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  FOR v_entry IN
    SELECT re.id, re.org_id
      FROM revenue_entries re
     WHERE re.project_id = NEW.project_id
       AND re.status = 'draft'
       AND NOT EXISTS (
         SELECT 1 FROM dept_revenue_allocations dra
          WHERE dra.revenue_entry_id = re.id
       )
  LOOP
    -- Khôi phục về confirmed rồi phân bổ
    UPDATE revenue_entries
       SET status     = 'confirmed',
           notes      = COALESCE(notes, '') ||
                        E'\n[Auto-confirmed: phòng ban đã được thêm — ' ||
                        TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI') || ']',
           updated_at = NOW()
     WHERE id = v_entry.id;

    PERFORM fn_allocate_dept_revenue(v_entry.id);

    INSERT INTO audit_logs (org_id, user_id, action, resource_type, resource_id, new_values)
    VALUES (
      v_entry.org_id,
      auth.uid(),
      'update',
      'revenue_entry',
      v_entry.id,
      jsonb_build_object(
        'trigger', 'project_dept_added_retry_alloc',
        'project_id', NEW.project_id,
        'dept_id', NEW.dept_id,
        'action_taken', 'confirmed_and_allocated'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- Tất cả triggers phiên bản cuối, nhóm theo chức năng
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Timestamp triggers (tự động cập nhật updated_at) ──────────────────────

CREATE TRIGGER trg_org_ts     BEFORE UPDATE ON organizations         FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_dept_ts    BEFORE UPDATE ON departments           FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_user_ts    BEFORE UPDATE ON users                 FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_task_ts    BEFORE UPDATE ON tasks                 FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_proj_ts    BEFORE UPDATE ON projects              FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_goal_ts    BEFORE UPDATE ON goals                 FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_goalt_ts   BEFORE UPDATE ON goal_targets          FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_allocc_ts  BEFORE UPDATE ON allocation_configs    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_allocp_ts  BEFORE UPDATE ON allocation_periods    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_tmpl_ts    BEFORE UPDATE ON task_templates        FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_form_ts    BEFORE UPDATE ON intake_forms          FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_dash_ts    BEFORE UPDATE ON dashboards            FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_auto_ts    BEFORE UPDATE ON automation_rules      FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_wft_ts     BEFORE UPDATE ON workflow_templates    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_center_ts  BEFORE UPDATE ON centers               FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_psc_ts     BEFORE UPDATE ON product_service_categories FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_ps_ts      BEFORE UPDATE ON product_services      FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_dra_ts     BEFORE UPDATE ON dept_revenue_allocations FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_cycle_config_ts BEFORE UPDATE ON allocation_cycle_config FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_salary_ts      BEFORE UPDATE ON salary_records          FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_deduction_ts   BEFORE UPDATE ON salary_deductions       FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_pdf_ts         BEFORE UPDATE ON project_dept_factors    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ─── Task scoring & status triggers ────────────────────────────────────────

CREATE TRIGGER trg_task_score   BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_auto_score_task();
CREATE TRIGGER trg_calc_kpi_scores BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_calc_kpi_scores();
CREATE TRIGGER trg_task_status  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_log_status_change();
CREATE TRIGGER trg_task_notify  AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_notify_task_kpi();

-- ─── Task progress triggers (auto-advance khi 100%) ────────────────────────

CREATE TRIGGER trg_task_before_progress  BEFORE UPDATE OF progress ON tasks FOR EACH ROW EXECUTE FUNCTION fn_task_before_progress();
CREATE TRIGGER trg_task_after_progress_workflow AFTER UPDATE OF progress ON tasks FOR EACH ROW EXECUTE FUNCTION fn_task_after_progress_workflow();

-- ─── Notification triggers ─────────────────────────────────────────────────

CREATE TRIGGER trg_task_notify_review    AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_notify_review();
CREATE TRIGGER trg_task_notify_completed AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_notify_completed();
CREATE TRIGGER trg_task_notify_revision  AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_notify_revision();

-- ─── Comment trigger ───────────────────────────────────────────────────────

CREATE TRIGGER trg_task_comment_notify
  AFTER INSERT ON task_comments
  FOR EACH ROW EXECUTE FUNCTION fn_notify_task_comment();

-- ─── Time tracking ─────────────────────────────────────────────────────────

CREATE TRIGGER trg_time_sync AFTER INSERT OR UPDATE OR DELETE ON time_entries FOR EACH ROW EXECUTE FUNCTION fn_sync_hours();

-- ─── Auth: tự tạo profile khi user mới đăng ký ────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── Revenue triggers ──────────────────────────────────────────────────────

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

CREATE TRIGGER trg_salary_apply_deductions
  BEFORE INSERT ON salary_records
  FOR EACH ROW EXECUTE FUNCTION fn_apply_deductions();

CREATE TRIGGER trg_addendum_rollback
  AFTER INSERT ON contract_addendums
  FOR EACH ROW WHEN (NEW.value_change < 0)
  EXECUTE FUNCTION fn_handle_addendum_rollback();

-- ─── Cascade triggers (soft-delete + retry) ────────────────────────────────

CREATE TRIGGER trg_task_soft_delete_cascade_revenue
  AFTER UPDATE OF deleted_at ON tasks
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION fn_cascade_task_soft_delete_to_revenue();

CREATE TRIGGER trg_project_dept_added_retry_alloc
  AFTER INSERT ON project_departments
  FOR EACH ROW
  EXECUTE FUNCTION fn_retry_unallocated_revenue();
