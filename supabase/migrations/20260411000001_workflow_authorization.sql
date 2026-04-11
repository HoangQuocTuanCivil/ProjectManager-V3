-- ═══════════════════════════════════════════════════════════════════════════════
-- fn_workflow_advance: thêm kiểm tra quyền actor trước khi advance
-- ═══════════════════════════════════════════════════════════════════════════════

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
  v_step_assignee UUID;
  v_actor_role user_role;
BEGIN
  IF p_result NOT IN ('completed', 'approved', 'rejected', 'revise') THEN
    RETURN jsonb_build_object('error', 'invalid_result');
  END IF;

  SELECT * INTO st FROM task_workflow_state WHERE task_id = p_task;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'no_state'); END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'no_task'); END IF;

  -- Authorization: p_actor IS NULL = system (cron/trigger), luôn được phép
  IF p_actor IS NOT NULL THEN
    SELECT role INTO v_actor_role FROM users WHERE id = p_actor;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'invalid_actor');
    END IF;

    v_step_assignee := (v_task.metadata -> 'step_assignees' ->> st.current_step_id::TEXT)::UUID;

    IF v_actor_role NOT IN ('admin', 'leader')
       AND p_actor != COALESCE(v_step_assignee, v_task.assignee_id)
    THEN
      RETURN jsonb_build_object('error', 'unauthorized',
        'message', 'Actor không được phép advance bước này');
    END IF;
  END IF;

  INSERT INTO workflow_history(task_id, step_id, action, actor_id, note)
  VALUES (p_task, st.current_step_id, p_result, p_actor, p_note);

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

    v_next_assignee := (v_task.metadata -> 'step_assignees' ->> nx::TEXT)::UUID;

    UPDATE task_workflow_state
    SET current_step_id = nx, entered_at = NOW(),
        completed_at = NULL, completed_by = NULL, result = NULL
    WHERE task_id = p_task;

    INSERT INTO workflow_history(task_id, step_id, action, actor_id)
    VALUES (p_task, nx, 'entered', p_actor);

    IF v_next_assignee IS NOT NULL THEN
      UPDATE tasks SET assignee_id = v_next_assignee WHERE id = p_task;

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
  ELSE
    UPDATE task_workflow_state
    SET completed_at = NOW(), completed_by = p_actor, result = p_result
    WHERE task_id = p_task;
  END IF;

  RETURN jsonb_build_object('status', 'workflow_completed', 'task_id', p_task);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS: siết task_workflow_state — chỉ admin/leader/head/team_leader có quyền ghi
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "tws_m" ON task_workflow_state;

CREATE POLICY "tws_m" ON task_workflow_state FOR ALL
  USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head', 'team_leader')
  );
