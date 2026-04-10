-- Liên kết HĐ giao khoán (incoming) với HĐ gốc (outgoing) để truy vết nguồn gốc
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS parent_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_parent ON contracts(parent_contract_id)
  WHERE parent_contract_id IS NOT NULL;

SELECT '013_contract_parent: done' AS status;
