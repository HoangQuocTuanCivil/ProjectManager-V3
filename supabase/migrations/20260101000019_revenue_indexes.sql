-- ============================================================================
-- REVENUE INDEXES BỔ SUNG
-- Tối ưu cho các query analytics thường dùng.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_re_method_status
  ON revenue_entries (method, status)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_re_source_contract
  ON revenue_entries (contract_id, method, status)
  WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intrev_status
  ON internal_revenue (status, created_at DESC);

SELECT '019_revenue_indexes: done' AS status;
