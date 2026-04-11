-- Notification enum: add missing values used by frontend
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'mention';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_comment';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'workflow_advanced';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'allocation_paid';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notification → Task FK (nullable, SET NULL on delete)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notif_task ON notifications(task_id, created_at DESC) WHERE task_id IS NOT NULL;

-- Backfill task_id from JSONB data field
UPDATE notifications
SET task_id = (data->>'task_id')::UUID
WHERE task_id IS NULL
  AND data->>'task_id' IS NOT NULL
  AND EXISTS (SELECT 1 FROM tasks WHERE id = (data->>'task_id')::UUID);

-- Comment notification trigger: notify assignee/assigner on new comment
CREATE OR REPLACE FUNCTION fn_notify_task_comment() RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
BEGIN
  SELECT org_id, assignee_id, assigner_id, title
  INTO v_task
  FROM tasks WHERE id = NEW.task_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Notify assignee (if commenter is not the assignee)
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

  -- Notify assigner (if different from assignee and commenter)
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

DROP TRIGGER IF EXISTS trg_task_comment_notify ON task_comments;
CREATE TRIGGER trg_task_comment_notify
  AFTER INSERT ON task_comments
  FOR EACH ROW EXECUTE FUNCTION fn_notify_task_comment();

-- Patch existing notification triggers to include task_id column
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
