-- Migration: Comprehensive task notifications
-- Notify relevant users for ALL task status changes and KPI events

-- 1. Notify assigner when status -> review
-- When assignee completes work (100%), assigner gets notified to review
CREATE OR REPLACE FUNCTION fn_notify_review() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'review' AND (OLD.status IS DISTINCT FROM 'review') AND NEW.assigner_id IS NOT NULL THEN
    INSERT INTO notifications(org_id, user_id, title, body, type, data)
    VALUES(
      NEW.org_id,
      NEW.assigner_id,
      'Công việc cần duyệt',
      format('CV: %s | Tiến độ: %s%% — Nhân viên đã hoàn thành, chờ bạn nghiệm thu.',
        NEW.title, NEW.progress),
      'workflow_pending',
      jsonb_build_object('task_id', NEW.id, 'assignee_id', NEW.assignee_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_notify_review ON tasks;
CREATE TRIGGER trg_task_notify_review
  AFTER UPDATE ON tasks FOR EACH ROW
  EXECUTE FUNCTION fn_notify_review();
-- 2. Notify assignee when task -> completed (after KPI evaluation)
-- Assigner evaluates -> assignee gets notified of result
CREATE OR REPLACE FUNCTION fn_notify_completed() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.assignee_id IS NOT NULL
     AND NEW.assignee_id IS DISTINCT FROM NEW.assigner_id THEN
    INSERT INTO notifications(org_id, user_id, title, body, type, data)
    VALUES(
      NEW.org_id,
      NEW.assignee_id,
      'Công việc đã được nghiệm thu',
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

DROP TRIGGER IF EXISTS trg_task_notify_completed ON tasks;
CREATE TRIGGER trg_task_notify_completed
  AFTER UPDATE ON tasks FOR EACH ROW
  EXECUTE FUNCTION fn_notify_completed();
-- 3. Notify assignee when task status changes back (rejected/revision)
-- If assigner rejects and sets status back to in_progress, notify assignee
CREATE OR REPLACE FUNCTION fn_notify_revision() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'review' AND NEW.status = 'in_progress'
     AND NEW.assignee_id IS NOT NULL THEN
    INSERT INTO notifications(org_id, user_id, title, body, type, data)
    VALUES(
      NEW.org_id,
      NEW.assignee_id,
      'Công việc cần sửa lại',
      format('CV: %s — Chưa đạt yêu cầu, vui lòng chỉnh sửa và nộp lại.', NEW.title),
      'task_assigned',
      jsonb_build_object('task_id', NEW.id, 'assigner_id', NEW.assigner_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_notify_revision ON tasks;
CREATE TRIGGER trg_task_notify_revision
  AFTER UPDATE ON tasks FOR EACH ROW
  EXECUTE FUNCTION fn_notify_revision();
