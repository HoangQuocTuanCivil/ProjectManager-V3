-- Cho phép tổng trọng số vượt 100% và gán cấu hình KPI theo trung tâm

ALTER TABLE allocation_configs DROP CONSTRAINT IF EXISTS chk_weights;

ALTER TABLE allocation_configs
  ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id) ON DELETE CASCADE;

-- Unique: mỗi org + center chỉ có 1 config active (center_id = NULL → toàn công ty)
ALTER TABLE allocation_configs DROP CONSTRAINT IF EXISTS allocation_configs_org_id_name_key;
ALTER TABLE allocation_configs
  ADD CONSTRAINT uq_alloc_config_org_center UNIQUE NULLS NOT DISTINCT (org_id, center_id);
