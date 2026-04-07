-- ============================================================================
-- A2Z WORKHUB — HỢP ĐỒNG & GIAO KHOÁN
-- Quản lý hợp đồng đầu ra/đầu vào, phụ lục, mốc thanh toán,
-- và phân bổ ngân sách giao khoán cho trung tâm/phòng ban.
-- ============================================================================

-- ─── ENUMS ──────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE contract_type AS ENUM ('outgoing', 'incoming');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE contract_status AS ENUM ('draft', 'active', 'completed', 'terminated', 'paused', 'settled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE billing_milestone_status AS ENUM ('upcoming', 'invoiced', 'paid', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── HỢP ĐỒNG ──────────────────────────────────────────────────────────────
-- Lưu trữ HĐ đầu ra (outgoing) và HĐ đầu vào/chi phí (incoming).
-- HĐ đầu vào được tạo tự động khi giao khoán ngân sách cho PB/TT.
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_type contract_type NOT NULL DEFAULT 'outgoing',
  contract_no TEXT NOT NULL,
  title TEXT NOT NULL,
  client_name TEXT,
  bid_package TEXT,
  contract_value NUMERIC(15,0) NOT NULL DEFAULT 0,
  vat_value NUMERIC(15,0) DEFAULT 0,
  signed_date DATE,
  start_date DATE,
  end_date DATE,
  guarantee_value NUMERIC(15,0) DEFAULT 0,
  guarantee_expiry DATE,
  status contract_status NOT NULL DEFAULT 'draft',
  file_url TEXT,
  notes TEXT,
  subcontractor_name TEXT,
  work_content TEXT,
  person_in_charge TEXT,
  contract_scope TEXT NOT NULL DEFAULT 'internal',
  product_service_id UUID REFERENCES product_services(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, contract_no)
);

-- Đảm bảo các cột tồn tại trên DB đã có bảng contracts trước đó
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_type contract_type NOT NULL DEFAULT 'outgoing';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS bid_package TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS vat_value NUMERIC(15,0) DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS subcontractor_name TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS work_content TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS person_in_charge TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_scope TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS product_service_id UUID REFERENCES product_services(id) ON DELETE SET NULL;

-- ─── PHỤ LỤC HỢP ĐỒNG ─────────────────────────────────────────────────────
-- Điều chỉnh giá trị, gia hạn thời gian cho HĐ đã ký.
CREATE TABLE IF NOT EXISTS contract_addendums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  addendum_no TEXT NOT NULL,
  title TEXT NOT NULL,
  addendum_value NUMERIC(15,0) NOT NULL DEFAULT 0,
  value_change NUMERIC(15,0) NOT NULL DEFAULT 0,
  new_end_date DATE,
  description TEXT,
  signed_date DATE,
  file_url TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MỐC THANH TOÁN ────────────────────────────────────────────────────────
-- Theo dõi tiến độ nghiệm thu và thanh toán theo từng mốc của HĐ.
CREATE TABLE IF NOT EXISTS billing_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  due_date DATE,
  status billing_milestone_status NOT NULL DEFAULT 'upcoming',
  paid_date DATE,
  invoice_no TEXT,
  sort_order INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_org ON contracts(org_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(org_id, contract_type, status);
CREATE INDEX IF NOT EXISTS idx_addendums_contract ON contract_addendums(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_contract ON billing_milestones(contract_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_billing_due ON billing_milestones(due_date, status) WHERE status IN ('upcoming', 'overdue');

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_addendums ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_milestones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ct_r" ON contracts FOR SELECT USING (org_id = public.user_org_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ct_m" ON contracts FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "ca_r" ON contract_addendums FOR SELECT
    USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ca_m" ON contract_addendums FOR ALL
    USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id())
      AND public.user_role() IN ('admin', 'leader', 'director'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "bm_r" ON billing_milestones FOR SELECT
    USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bm_m" ON billing_milestones FOR ALL
    USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id())
      AND public.user_role() IN ('admin', 'leader', 'director'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── STORAGE ────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contract-files', 'contract-files', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "contract_files_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contract-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "contract_files_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contract-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "contract_files_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contract-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── GIAO KHOÁN: đảm bảo dept_budget_allocations có đầy đủ cột ─────────────
-- Liên kết giao khoán với hợp đồng gốc, trung tâm nhận, ngày hoàn thành,
-- mã HĐ giao khoán, và file phiếu giao nhiệm vụ đính kèm.
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id) ON DELETE CASCADE;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS delivery_progress NUMERIC(5,2) DEFAULT 0;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS allocation_code TEXT;
ALTER TABLE dept_budget_allocations ADD COLUMN IF NOT EXISTS task_document_url TEXT;

-- dept_id cho phép NULL vì giao khoán có thể gán cho trung tâm thay vì phòng ban
DO $$ BEGIN
  ALTER TABLE dept_budget_allocations ALTER COLUMN dept_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_dba_contract ON dept_budget_allocations(contract_id) WHERE contract_id IS NOT NULL;

-- ─── NGHIỆM THU: giá trị được thanh toán và giá trị thực thanh toán ────────
-- payable_amount: số tiền được duyệt thanh toán sau nghiệm thu (có thể < giá trị NT)
-- paid_amount: số tiền đã thực trả cho đợt nghiệm thu này
ALTER TABLE billing_milestones ADD COLUMN IF NOT EXISTS payable_amount NUMERIC(15,0) DEFAULT 0;
ALTER TABLE billing_milestones ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,0) DEFAULT 0;

SELECT '006_contracts: done' AS status;
