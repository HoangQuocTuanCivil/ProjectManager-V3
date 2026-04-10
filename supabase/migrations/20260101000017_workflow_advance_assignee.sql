-- Khi chuyển bước workflow, tự động gán assignee_id = người phụ trách
-- bước tiếp theo (lấy từ task.metadata.step_assignees).
-- Đồng thời gửi thông báo cho người phụ trách bước mới.

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

  -- Tìm transition sang bước tiếp theo dựa trên điều kiện
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

SELECT '017_workflow_advance_assignee: done' AS status;
