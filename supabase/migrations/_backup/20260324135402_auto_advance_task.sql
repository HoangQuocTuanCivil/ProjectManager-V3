-- Add triggers to auto-advance task status and workflow when progress = 100%

-- 1. BEFORE UPDATE TRIGGER: Update status to 'review' if progress hits 100%
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

DROP TRIGGER IF EXISTS trg_task_before_progress ON tasks;
CREATE TRIGGER trg_task_before_progress 
  BEFORE UPDATE OF progress ON tasks 
  FOR EACH ROW 
  EXECUTE FUNCTION fn_task_before_progress();
-- 2. AFTER UPDATE TRIGGER: Call fn_workflow_advance to handle workflow routing
CREATE OR REPLACE FUNCTION fn_task_after_progress_workflow() RETURNS TRIGGER AS $$
DECLARE
  v_step_type workflow_step_type;
BEGIN
  IF NEW.progress = 100 AND OLD.progress < 100 THEN
    -- Check if it's currently in an "execute" step of a workflow
    SELECT ws.step_type INTO v_step_type
    FROM task_workflow_state tws
    JOIN workflow_steps ws ON tws.current_step_id = ws.id
    WHERE tws.task_id = NEW.id AND tws.completed_at IS NULL;

    -- If found and it is in execute state, advance it
    IF FOUND AND v_step_type = 'execute' THEN
      -- Use assignee_id as the actor if possible (since they usually execute it)
      PERFORM fn_workflow_advance(
        NEW.id, 
        COALESCE(NEW.assignee_id, NEW.assigner_id), -- fallback to assigner if no assignee
        'completed', 
        'Tự động hoàn thành bước thực hiện (Tiến độ 100%)'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_after_progress_workflow ON tasks;
CREATE TRIGGER trg_task_after_progress_workflow 
  AFTER UPDATE OF progress ON tasks 
  FOR EACH ROW 
  EXECUTE FUNCTION fn_task_after_progress_workflow();
