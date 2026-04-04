-- ============================================================================
-- A2Z WORKHUB — FUNCTIONS & TRIGGERS
-- ============================================================================

-- ─── AUTH HELPERS ────────────────────────────────────────────────────────────
-- Các hàm lấy thông tin user hiện tại, SECURITY DEFINER để bypass RLS

CREATE OR REPLACE FUNCTION auth.user_org_id() RETURNS UUID AS $$
  SELECT org_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_dept_id() RETURNS UUID AS $$
  SELECT dept_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_role() RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Lấy center_id user hiện tại, SECURITY DEFINER tránh vòng lặp RLS
CREATE OR REPLACE FUNCTION auth.user_center_id() RETURNS UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT center_id FROM users WHERE id = auth.uid();
$$;

-- Public-schema wrappers
CREATE OR REPLACE FUNCTION public.user_dept_id() RETURNS UUID AS $$
  SELECT dept_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_team_id() RETURNS UUID AS $$
  SELECT team_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_center_id() RETURNS UUID AS $$
  SELECT center_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── UTILITY ─────────────────────────────────────────────────────────────────

-- Tự động cập nhật cột updated_at khi row bị sửa
CREATE OR REPLACE FUNCTION fn_update_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ─── TASK SCORING ────────────────────────────────────────────────────────────

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

-- ─── KPI ─────────────────────────────────────────────────────────────────────

-- Nghiệm thu KPI task: chấm điểm volume, ahead, quality, difficulty
-- Phiên bản cuối: có params p_vol và p_ahd
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

-- ─── ALLOCATION (CHIA KHOÁN) ─────────────────────────────────────────────────

-- Tính khoán thông minh: tính KPI trung bình mỗi user từ tasks hoàn thành trong kỳ,
-- chia quỹ khoán theo tỷ lệ weighted score
-- Phiên bản cuối: có COALESCE cho NULL values, xử lý NULL period dates
CREATE OR REPLACE FUNCTION fn_allocate_smart(
  p_period_id UUID,
  p_use_actual BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
  v_period   RECORD;
  v_config   RECORD;
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

  IF v_period.status = 'approved' OR v_period.status = 'paid' THEN
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
      AVG(COALESCE(CASE WHEN p_use_actual THEN t.actual_ahead    ELSE t.expect_ahead    END, 50))::NUMERIC(5,2) AS avg_ahd
    FROM tasks t
    WHERE t.org_id = v_period.org_id
      AND t.status = 'completed'
      AND t.assignee_id IS NOT NULL
      AND (
        (v_period.period_start IS NOT NULL AND v_period.period_end IS NOT NULL
         AND t.completed_at::DATE BETWEEN v_period.period_start AND v_period.period_end)
        OR (v_period.period_start IS NULL OR v_period.period_end IS NULL)
      )
      AND (v_period.mode = 'global' OR (v_period.project_id IS NOT NULL AND t.project_id = v_period.project_id))
      AND (v_period.dept_id IS NULL OR t.dept_id = v_period.dept_id)
    GROUP BY t.assignee_id
  LOOP
    DECLARE
      ws NUMERIC(7,2);
    BEGIN
      ws := r.avg_vol  * v_period.weight_volume
          + r.avg_qual * v_period.weight_quality
          + r.avg_diff * v_period.weight_difficulty
          + r.avg_ahd  * v_period.weight_ahead;

      INSERT INTO allocation_results (
        period_id, user_id, project_id, mode,
        avg_volume, avg_quality, avg_difficulty, avg_ahead,
        weighted_score, task_count, breakdown
      ) VALUES (
        p_period_id, r.user_id, v_period.project_id, v_period.mode,
        r.avg_vol, r.avg_qual, r.avg_diff, r.avg_ahd,
        ws, r.task_count,
        jsonb_build_object(
          'volume', r.avg_vol, 'quality', r.avg_qual,
          'difficulty', r.avg_diff, 'ahead', r.avg_ahd,
          'use_actual', p_use_actual
        )
      );

      v_total_ws := v_total_ws + ws;
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
    'mode', v_period.mode
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

-- Thông báo khi task được giao hoặc đổi assignee, kèm điểm KPI kỳ vọng
CREATE OR REPLACE FUNCTION fn_notify_task_kpi() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id) THEN
    INSERT INTO notifications(org_id,user_id,title,body,type,data)
    VALUES(NEW.org_id,NEW.assignee_id,'Bạn được giao công việc mới',
      format('CV: %s | KPI kỳ vọng: %s (KL:%s CL:%s ĐK:%s VTĐ:%s) | W:%s/10',
        NEW.title,NEW.expect_score,NEW.expect_volume,NEW.expect_quality,NEW.expect_difficulty,NEW.expect_ahead,NEW.kpi_weight),
      'task_assigned',
      jsonb_build_object('task_id',NEW.id,'assigner_id',NEW.assigner_id,'kpi_weight',NEW.kpi_weight,'expect_score',NEW.expect_score));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thông báo người giao khi task chuyển sang trạng thái chờ duyệt
CREATE OR REPLACE FUNCTION fn_notify_review() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'review' AND (OLD.status IS DISTINCT FROM 'review') AND NEW.assigner_id IS NOT NULL THEN
    INSERT INTO notifications(org_id, user_id, title, body, type, data)
    VALUES(
      NEW.org_id, NEW.assigner_id, 'Công việc cần duyệt',
      format('CV: %s | Tiến độ: %s%% — Nhân viên đã hoàn thành, chờ bạn nghiệm thu.', NEW.title, NEW.progress),
      'workflow_pending',
      jsonb_build_object('task_id', NEW.id, 'assignee_id', NEW.assignee_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thông báo assignee khi task được nghiệm thu (completed), kèm kết quả KPI
CREATE OR REPLACE FUNCTION fn_notify_completed() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.assignee_id IS NOT NULL
     AND NEW.assignee_id IS DISTINCT FROM NEW.assigner_id THEN
    INSERT INTO notifications(org_id, user_id, title, body, type, data)
    VALUES(
      NEW.org_id, NEW.assignee_id, 'Công việc đã được nghiệm thu',
      format('CV: %s | Điểm KPI: %s (Kỳ vọng: %s, Chênh lệch: %s)',
        NEW.title,
        COALESCE(NEW.actual_score::TEXT, 'N/A'),
        COALESCE(NEW.expect_score::TEXT, 'N/A'),
        CASE WHEN NEW.kpi_variance >= 0 THEN '+' ELSE '' END || COALESCE(ROUND(NEW.kpi_variance)::TEXT, '0')),
      'kpi_evaluated',
      jsonb_build_object('task_id', NEW.id, 'actual_score', NEW.actual_score, 'expect_score', NEW.expect_score, 'kpi_variance', NEW.kpi_variance)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thông báo assignee khi task bị trả lại từ review → in_progress
CREATE OR REPLACE FUNCTION fn_notify_revision() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'review' AND NEW.status = 'in_progress'
     AND NEW.assignee_id IS NOT NULL THEN
    INSERT INTO notifications(org_id, user_id, title, body, type, data)
    VALUES(
      NEW.org_id, NEW.assignee_id, 'Công việc cần sửa lại',
      format('CV: %s — Chưa đạt yêu cầu, vui lòng chỉnh sửa và nộp lại.', NEW.title),
      'task_assigned',
      jsonb_build_object('task_id', NEW.id, 'assigner_id', NEW.assigner_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── TASK AUTOMATION ─────────────────────────────────────────────────────────

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

-- ─── WORKFLOW ────────────────────────────────────────────────────────────────

-- Chuyển bước workflow: ghi lịch sử, tìm transition tiếp theo, advance
CREATE OR REPLACE FUNCTION fn_workflow_advance(p_task UUID, p_actor UUID, p_result TEXT DEFAULT 'completed', p_note TEXT DEFAULT NULL) RETURNS JSONB AS $$
DECLARE st RECORD; nx UUID; ns RECORD; cond TEXT;
BEGIN
  SELECT * INTO st FROM task_workflow_state WHERE task_id=p_task;
  IF NOT FOUND THEN RETURN '{"error":"no state"}'::JSONB; END IF;
  INSERT INTO workflow_history(task_id,step_id,action,actor_id,note) VALUES(p_task,st.current_step_id,p_result,p_actor,p_note);
  UPDATE task_workflow_state SET completed_at=NOW(),completed_by=p_actor,result=p_result WHERE task_id=p_task;
  SELECT wt.to_step_id,wt.condition_type INTO nx,cond FROM workflow_transitions wt
  WHERE wt.from_step_id=st.current_step_id AND (wt.condition_type='always' OR (wt.condition_type='if_approved' AND p_result='approved') OR (wt.condition_type='if_rejected' AND p_result='rejected')) LIMIT 1;
  IF nx IS NOT NULL THEN
    SELECT * INTO ns FROM workflow_steps WHERE id=nx;
    UPDATE task_workflow_state SET current_step_id=nx,entered_at=NOW(),completed_at=NULL,completed_by=NULL,result=NULL WHERE task_id=p_task;
    INSERT INTO workflow_history(task_id,step_id,action,actor_id) VALUES(p_task,nx,'entered',p_actor);
    RETURN jsonb_build_object('status','advanced','to_step',nx,'step_name',ns.name,'auto',ns.is_automatic);
  END IF;
  RETURN jsonb_build_object('status','workflow_completed','task_id',p_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── PERMISSIONS ─────────────────────────────────────────────────────────────

-- Kiểm tra quyền user: admin → full, custom_role → kiểm tra bảng role_permissions,
-- các role khác → danh sách quyền cố định theo cấp bậc
-- Phiên bản cuối: gồm director và team_leader
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

-- ─── OTHER UTILITIES ─────────────────────────────────────────────────────────

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

-- ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

-- Tự tạo profile trong public.users khi có user mới đăng ký qua auth
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── TRIGGERS ────────────────────────────────────────────────────────────────

-- Timestamp triggers (tự động cập nhật updated_at)
CREATE TRIGGER trg_org_ts BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_dept_ts BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_user_ts BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_task_ts BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_proj_ts BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_goal_ts BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_goalt_ts BEFORE UPDATE ON goal_targets FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_allocc_ts BEFORE UPDATE ON allocation_configs FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_allocp_ts BEFORE UPDATE ON allocation_periods FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_tmpl_ts BEFORE UPDATE ON task_templates FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_form_ts BEFORE UPDATE ON intake_forms FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_dash_ts BEFORE UPDATE ON dashboards FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_auto_ts BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_wft_ts BEFORE UPDATE ON workflow_templates FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_center_ts BEFORE UPDATE ON centers FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Task scoring & status triggers
CREATE TRIGGER trg_task_score BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_auto_score_task();
CREATE TRIGGER trg_task_status BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_log_status_change();
CREATE TRIGGER trg_task_notify AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_notify_task_kpi();

-- Task progress triggers (auto-advance khi 100%)
CREATE TRIGGER trg_task_before_progress BEFORE UPDATE OF progress ON tasks FOR EACH ROW EXECUTE FUNCTION fn_task_before_progress();
CREATE TRIGGER trg_task_after_progress_workflow AFTER UPDATE OF progress ON tasks FOR EACH ROW EXECUTE FUNCTION fn_task_after_progress_workflow();

-- Notification triggers
CREATE TRIGGER trg_task_notify_review AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_notify_review();
CREATE TRIGGER trg_task_notify_completed AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_notify_completed();
CREATE TRIGGER trg_task_notify_revision AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_notify_revision();

-- Time tracking
CREATE TRIGGER trg_time_sync AFTER INSERT OR UPDATE OR DELETE ON time_entries FOR EACH ROW EXECUTE FUNCTION fn_sync_hours();

-- Auth: tự tạo profile khi user mới đăng ký
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

SELECT '✅ 002_functions: Tất cả functions và triggers đã tạo xong' AS status;
