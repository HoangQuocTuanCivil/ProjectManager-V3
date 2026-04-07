-- ============================================================================
-- BỔ SUNG CỘT THIẾU CHO dept_budget_allocations
-- Bảng trên Cloud tạo từ schema cũ, thiếu nhiều cột đã thêm sau.
-- Dùng ADD COLUMN IF NOT EXISTS để chạy an toàn.
-- ============================================================================

ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id) ON DELETE CASCADE;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS delivery_progress NUMERIC(5,2) DEFAULT 0;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS allocation_code TEXT;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS task_document_url TEXT;

-- Cho phép dept_id NULL (khi giao cho trung tâm thay vì phòng ban)
ALTER TABLE dept_budget_allocations ALTER COLUMN dept_id DROP NOT NULL;

-- Index theo hợp đồng
CREATE INDEX IF NOT EXISTS idx_dba_contract ON dept_budget_allocations(contract_id) WHERE contract_id IS NOT NULL;

SELECT '✅ 010: dept_budget_allocations columns synced' AS status;
