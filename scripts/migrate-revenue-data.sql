-- ============================================================================
-- DATA MIGRATION: Dữ liệu doanh thu hiện tại → schema mới
-- Chạy SAU KHI apply 20260101000008_revenue_enhanced.sql
-- ============================================================================

BEGIN;

-- ─── B1: Snapshot trước migration ──────────────────────────────────────────

CREATE TEMP TABLE _migration_snapshot AS
SELECT
  'revenue_entries' AS tbl,
  COUNT(*)          AS row_count,
  COALESCE(SUM(amount), 0) AS total_amount
FROM revenue_entries
UNION ALL
SELECT 'internal_revenue', COUNT(*), COALESCE(SUM(total_amount), 0) FROM internal_revenue
UNION ALL
SELECT 'cost_entries', COUNT(*), COALESCE(SUM(amount), 0) FROM cost_entries;

-- ─── B2: Update cột mới cho entries cũ ─────────────────────────────────────

UPDATE revenue_entries
SET
  status = 'confirmed',
  recognition_date = COALESCE(period_start, created_at::date)
WHERE status = 'draft'
  AND created_at < NOW() - INTERVAL '1 minute';

-- ─── B3: Tạo dept allocations cho entries có project_id ─────────────────────

DO $$
DECLARE
  v_entry RECORD;
BEGIN
  FOR v_entry IN
    SELECT id
    FROM revenue_entries
    WHERE project_id IS NOT NULL
      AND status = 'confirmed'
      AND NOT EXISTS (
        SELECT 1 FROM dept_revenue_allocations dra
        WHERE dra.revenue_entry_id = revenue_entries.id
      )
    ORDER BY created_at
  LOOP
    PERFORM fn_allocate_dept_revenue(v_entry.id);
  END LOOP;
END;
$$;

-- ─── B4: Verify data integrity ─────────────────────────────────────────────

DO $$
DECLARE
  v_before RECORD;
  v_after  RECORD;
BEGIN
  SELECT row_count, total_amount INTO v_before
  FROM _migration_snapshot WHERE tbl = 'revenue_entries';

  SELECT COUNT(*) AS row_count, COALESCE(SUM(amount), 0) AS total_amount
  INTO v_after FROM revenue_entries;

  IF v_before.row_count <> v_after.row_count THEN
    RAISE EXCEPTION 'Row count mismatch: before=%, after=%', v_before.row_count, v_after.row_count;
  END IF;

  IF v_before.total_amount <> v_after.total_amount THEN
    RAISE EXCEPTION 'Amount mismatch: before=%, after=%', v_before.total_amount, v_after.total_amount;
  END IF;

  -- Verify no NULL status
  IF EXISTS (SELECT 1 FROM revenue_entries WHERE status IS NULL) THEN
    RAISE EXCEPTION 'Found entries with NULL status after migration';
  END IF;

  -- Verify no NULL recognition_date
  IF EXISTS (SELECT 1 FROM revenue_entries WHERE recognition_date IS NULL) THEN
    RAISE EXCEPTION 'Found entries with NULL recognition_date after migration';
  END IF;

  -- Verify no orphan allocations
  IF EXISTS (
    SELECT 1 FROM dept_revenue_allocations dra
    WHERE NOT EXISTS (SELECT 1 FROM revenue_entries re WHERE re.id = dra.revenue_entry_id)
  ) THEN
    RAISE EXCEPTION 'Found orphan dept_revenue_allocations';
  END IF;

  RAISE NOTICE 'Migration verified: % entries, total amount = %', v_after.row_count, v_after.total_amount;
END;
$$;

DROP TABLE _migration_snapshot;

COMMIT;
