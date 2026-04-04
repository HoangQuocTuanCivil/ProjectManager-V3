-- Backfill: Update existing 100% progress tasks to status = 'review'
-- These tasks existed before the auto-advance trigger was created
UPDATE tasks
SET status = 'review'
WHERE progress = 100
  AND status IN ('pending', 'in_progress');
