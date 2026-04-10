-- Phân quyền truy cập module theo trung tâm hoặc phòng ban.
-- Admin cấu hình module nào hiển thị cho đơn vị nào.
-- Mặc định: tất cả module đều mở; chỉ record is_enabled=false mới ẩn.

CREATE TABLE IF NOT EXISTS module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('center', 'dept')),
  target_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, module_key, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_module_access_target
  ON module_access(org_id, target_type, target_id);

-- RLS: mọi user cùng org đều đọc được (sidebar cần check), chỉ admin sửa
ALTER TABLE module_access ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ma_r" ON module_access FOR SELECT
    USING (org_id = public.user_org_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "ma_m" ON module_access FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: tắt Hợp đồng, Doanh thu, Chi phí cho các trung tâm thiết kế
INSERT INTO module_access (org_id, module_key, target_type, target_id, is_enabled)
SELECT
  'a2a00000-0000-0000-0000-000000000001',
  m.key,
  'center',
  c.id,
  false
FROM
  (VALUES ('contracts'), ('revenue'), ('costs')) AS m(key)
CROSS JOIN
  centers c
WHERE c.is_active = true
  AND c.name ILIKE '%thiết kế%'
ON CONFLICT (org_id, module_key, target_type, target_id) DO NOTHING;

SELECT '014_module_access: done' AS status;
