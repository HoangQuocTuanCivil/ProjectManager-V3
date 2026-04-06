-- ============================================================================
-- A2Z WORKHUB — PHASE 2: LƯƠNG, KỲ KHOÁN, HỆ SỐ KHÓ
--
-- Mô hình "Lương = Ứng trước": lương hàng tháng là khoản ứng trước.
-- Cuối kỳ khoán (3/6 tháng), so sánh sản lượng vs tổng lương:
--   Sản lượng > Lương → bonus_amount (thưởng)
--   Sản lượng < Lương → salary_deductions (trừ dần các tháng sau)
--
-- Bảng mới: allocation_cycle_config, salary_records, salary_deductions,
--           project_dept_factors
-- Mở rộng: allocation_results (+total_salary_paid, +bonus_amount, +deduction_id)
-- ============================================================================

-- ─── ENUMS ──────────────────────────────────────────────────────────────────

CREATE TYPE salary_deduction_status AS ENUM ('active', 'completed', 'cancelled');

-- ─── CẤU HÌNH KỲ KHOÁN ────────────────────────────────────────────────────
-- Mỗi org có đúng 1 cấu hình kỳ khoán (UNIQUE org_id).
-- cycle_months: độ dài chu kỳ (3 = quý, 6 = nửa năm).
-- start_month: tháng bắt đầu chu kỳ đầu tiên trong năm (VD: 1 = Tháng 1).

CREATE TABLE allocation_cycle_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_months INT NOT NULL DEFAULT 3
    CONSTRAINT chk_cycle_months CHECK (cycle_months IN (3, 6)),
  start_month  INT NOT NULL DEFAULT 1
    CONSTRAINT chk_start_month CHECK (start_month BETWEEN 1 AND 12),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cycle_config_org UNIQUE (org_id)
);

CREATE TRIGGER trg_cycle_config_ts
  BEFORE UPDATE ON allocation_cycle_config
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ─── BẢNG LƯƠNG HÀNG THÁNG ────────────────────────────────────────────────
-- Ghi nhận lương ứng trước mỗi tháng cho từng nhân viên.
-- base_salary: lương cơ bản theo hợp đồng lao động.
-- deduction_applied: khoản đã khấu trừ từ salary_deductions (≥ 0).
-- net_salary: lương thực nhận = base_salary − deduction_applied.

CREATE TABLE salary_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id),
  dept_id           UUID REFERENCES departments(id) ON DELETE SET NULL,
  month             DATE NOT NULL,
  base_salary       NUMERIC(15,0) NOT NULL DEFAULT 0,
  deduction_applied NUMERIC(15,0) NOT NULL DEFAULT 0
    CONSTRAINT chk_deduction_non_negative CHECK (deduction_applied >= 0),
  net_salary        NUMERIC(15,0) GENERATED ALWAYS AS (base_salary - deduction_applied) STORED,
  notes             TEXT,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_salary_user_month UNIQUE (org_id, user_id, month)
);

CREATE INDEX idx_salary_org  ON salary_records (org_id, month DESC);
CREATE INDEX idx_salary_user ON salary_records (user_id, month);
CREATE INDEX idx_salary_dept ON salary_records (dept_id, month DESC) WHERE dept_id IS NOT NULL;

CREATE TRIGGER trg_salary_ts
  BEFORE UPDATE ON salary_records
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ─── KHẤU TRỪ LƯƠNG ───────────────────────────────────────────────────────
-- Phát sinh khi kết thúc kỳ khoán mà sản lượng nhân viên < tổng lương đã ứng.
-- total_amount: tổng phải trừ = tổng lương kỳ − sản lượng thực tế.
-- remaining_amount: phần còn lại chưa trừ (giảm dần mỗi tháng).
-- monthly_deduction: mức trừ cố định hàng tháng (thoả thuận với NV).
-- status: active (đang trừ) → completed (trừ hết) | cancelled (huỷ bỏ).

CREATE TABLE salary_deductions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id),
  period_id         UUID NOT NULL REFERENCES allocation_periods(id) ON DELETE CASCADE,
  total_amount      NUMERIC(15,0) NOT NULL DEFAULT 0
    CONSTRAINT chk_deduction_total_positive CHECK (total_amount > 0),
  remaining_amount  NUMERIC(15,0) NOT NULL DEFAULT 0
    CONSTRAINT chk_remaining_non_negative CHECK (remaining_amount >= 0),
  monthly_deduction NUMERIC(15,0) NOT NULL DEFAULT 0
    CONSTRAINT chk_monthly_positive CHECK (monthly_deduction > 0),
  status            salary_deduction_status NOT NULL DEFAULT 'active',
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_deduction_user_period UNIQUE (user_id, period_id)
);

CREATE INDEX idx_deduction_org    ON salary_deductions (org_id, status);
CREATE INDEX idx_deduction_user   ON salary_deductions (user_id, status);
CREATE INDEX idx_deduction_period ON salary_deductions (period_id);
CREATE INDEX idx_deduction_active ON salary_deductions (user_id, created_at)
  WHERE status = 'active' AND remaining_amount > 0;

CREATE TRIGGER trg_deduction_ts
  BEFORE UPDATE ON salary_deductions
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ─── MỞ RỘNG allocation_results ────────────────────────────────────────────
-- Thêm cột liên kết kết quả khoán với dữ liệu lương:
--   total_salary_paid: tổng lương đã ứng trong kỳ khoán cho user này
--   bonus_amount: thưởng nếu sản lượng > lương (allocated_amount − total_salary_paid)
--   deduction_id: trỏ đến salary_deductions nếu sản lượng < lương

ALTER TABLE allocation_results
  ADD COLUMN total_salary_paid NUMERIC(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN bonus_amount      NUMERIC(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN deduction_id      UUID REFERENCES salary_deductions(id) ON DELETE SET NULL;

CREATE INDEX idx_alloc_results_deduction
  ON allocation_results (deduction_id) WHERE deduction_id IS NOT NULL;

-- ─── HỆ SỐ KHÓ THEO DỰ ÁN / PHÒNG BAN ────────────────────────────────────
-- Điều chỉnh mức đóng góp thực tế của PB trong dự án: factor > 1.0 nghĩa là
-- phần việc PB này khó hơn trung bình, factor < 1.0 nghĩa là dễ hơn.
-- Mặc định 1.0 (không điều chỉnh). Dùng khi tính quỹ khoán dự kiến.

CREATE TABLE project_dept_factors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dept_id           UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  difficulty_factor NUMERIC(4,2) NOT NULL DEFAULT 1.00
    CONSTRAINT chk_factor_positive CHECK (difficulty_factor > 0),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_project_dept_factor UNIQUE (project_id, dept_id)
);

CREATE INDEX idx_pdf_project ON project_dept_factors (project_id);
CREATE INDEX idx_pdf_dept    ON project_dept_factors (dept_id);

CREATE TRIGGER trg_pdf_ts
  BEFORE UPDATE ON project_dept_factors
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE allocation_cycle_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_dept_factors ENABLE ROW LEVEL SECURITY;

-- Cấu hình kỳ khoán
CREATE POLICY acc_r ON allocation_cycle_config FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY acc_m ON allocation_cycle_config FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- Bảng lương
CREATE POLICY sr_r ON salary_records FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY sr_m ON salary_records FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- Khấu trừ
CREATE POLICY sd_r ON salary_deductions FOR SELECT
  USING (org_id = public.user_org_id());
CREATE POLICY sd_m ON salary_deductions FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director'));

-- Hệ số khó
CREATE POLICY pdf_r ON project_dept_factors FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id()));
CREATE POLICY pdf_m ON project_dept_factors FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director'));

SELECT '✅ Phase 2 schema: 4 tables + 1 ALTER + RLS created' AS status;
