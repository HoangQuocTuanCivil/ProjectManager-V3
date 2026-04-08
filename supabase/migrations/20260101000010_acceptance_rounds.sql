-- Đợt nghiệm thu nội bộ cho từng hợp đồng giao khoán (dept_budget_allocations).
-- Mỗi giao khoán có nhiều đợt, mỗi đợt ghi nhận số tiền nghiệm thu.
-- Tính toán Lũy kế và còn lại từ danh sách đợt đã sort.

CREATE TABLE IF NOT EXISTS acceptance_rounds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id   UUID NOT NULL REFERENCES dept_budget_allocations(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  round_name      TEXT NOT NULL,
  amount          NUMERIC(15,0) NOT NULL DEFAULT 0,
  round_date      DATE,
  note            TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acceptance_rounds_allocation
  ON acceptance_rounds(allocation_id, sort_order);
