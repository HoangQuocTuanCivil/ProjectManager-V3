-- Migration 013: Functions & Triggers

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION fn_update_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Auto-score task (volume + ahead)
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

-- Log task status change
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

-- Notify task with KPI
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

-- Sync actual_hours from time_entries
CREATE OR REPLACE FUNCTION fn_sync_hours() RETURNS TRIGGER AS $$
BEGIN
  UPDATE tasks SET actual_hours=(SELECT ROUND(SUM(duration_minutes)::NUMERIC/60,1) FROM time_entries WHERE task_id=COALESCE(NEW.task_id,OLD.task_id))
  WHERE id=COALESCE(NEW.task_id,OLD.task_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Evaluate task KPI
CREATE OR REPLACE FUNCTION fn_evaluate_task_kpi(p_task UUID, p_eval UUID, p_qual INT, p_diff INT, p_note TEXT DEFAULT NULL) RETURNS JSONB AS $$
DECLARE t RECORD; r JSONB;
BEGIN
  UPDATE tasks SET actual_quality=p_qual, actual_difficulty=p_diff, kpi_evaluated_by=p_eval, kpi_evaluated_at=NOW(), kpi_note=p_note, status='completed'
  WHERE id=p_task RETURNING * INTO t;
  r = jsonb_build_object('task_id',t.id,'expect_score',t.expect_score,'actual_score',t.actual_score,'variance',t.kpi_variance,
    'verdict',CASE WHEN t.kpi_variance>=10 THEN 'exceptional' WHEN t.kpi_variance>=0 THEN 'exceeded' WHEN t.kpi_variance>=-10 THEN 'near' ELSE 'below' END);
  INSERT INTO audit_logs(org_id,user_id,action,resource_type,resource_id,new_values) VALUES(t.org_id,p_eval,'approve','task_kpi',p_task,r);
  RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Workflow advance
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

-- Check permission
CREATE OR REPLACE FUNCTION fn_has_permission(p_user UUID, p_perm TEXT) RETURNS BOOLEAN AS $$
DECLARE v_role user_role; v_cr UUID;
BEGIN
  SELECT role,custom_role_id INTO v_role,v_cr FROM users WHERE id=p_user;
  IF v_role='admin' THEN RETURN TRUE; END IF;
  IF v_cr IS NOT NULL THEN RETURN EXISTS(SELECT 1 FROM role_permissions WHERE role_id=v_cr AND permission_id=p_perm); END IF;
  RETURN CASE v_role
    WHEN 'leader' THEN p_perm NOT IN ('settings.security')
    WHEN 'head' THEN p_perm IN ('task.view_dept','task.create','task.edit_others','task.update_progress','task.score_kpi','task.approve','project.view_all','project.edit','project.manage_members','kpi.view_dept','kpi.view_self','settings.templates','goals.create','goals.view_all')
    WHEN 'staff' THEN p_perm IN ('task.view_self','task.update_progress','kpi.view_self')
    ELSE FALSE END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get org setting
CREATE OR REPLACE FUNCTION fn_get_setting(p_org UUID, p_cat TEXT, p_key TEXT) RETURNS JSONB AS $$
  SELECT value FROM org_settings WHERE org_id=p_org AND category=p_cat AND key=p_key;
$$ LANGUAGE SQL STABLE;

-- TRIGGERS

CREATE TRIGGER trg_org_ts BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_dept_ts BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_user_ts BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_task_ts BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_task_score BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_auto_score_task();
CREATE TRIGGER trg_task_status BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_log_status_change();
CREATE TRIGGER trg_task_notify AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_notify_task_kpi();
CREATE TRIGGER trg_time_sync AFTER INSERT OR UPDATE OR DELETE ON time_entries FOR EACH ROW EXECUTE FUNCTION fn_sync_hours();
