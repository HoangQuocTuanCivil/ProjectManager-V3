-- ============================================================================
-- BỔ SUNG CỘT THIẾU CHO BẢNG CONTRACTS
-- Bảng contracts trên Cloud được tạo từ schema cũ, thiếu các cột từ
-- migration 20260101000006_contracts.sql. Dùng ADD COLUMN IF NOT EXISTS
-- để an toàn chạy trên cả DB mới lẫn DB đã có bảng contracts.
-- ============================================================================

-- Enum contract_type nếu chưa tồn tại
DO $$ BEGIN
  CREATE TYPE contract_type AS ENUM ('outgoing', 'incoming');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Các cột thiếu trên bảng contracts
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_type contract_type NOT NULL DEFAULT 'outgoing';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS bid_package TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS vat_value NUMERIC(15,0) DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS subcontractor_name TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS work_content TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS person_in_charge TEXT;
