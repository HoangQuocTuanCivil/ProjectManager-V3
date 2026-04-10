-- Cho phép tất cả user (head, team_leader, staff) tạo/sửa/xóa
-- hợp đồng, doanh thu, chi phí — không giới hạn chỉ admin/leader/director.

-- Hợp đồng: mở rộng từ admin/leader/director → tất cả user cùng org
DROP POLICY IF EXISTS "ct_m" ON contracts;
CREATE POLICY "ct_m" ON contracts FOR ALL
  USING (org_id = public.user_org_id());

-- Phụ lục hợp đồng
DROP POLICY IF EXISTS "ca_m" ON contract_addendums;
CREATE POLICY "ca_m" ON contract_addendums FOR ALL
  USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id()));

-- Mốc thanh toán
DROP POLICY IF EXISTS "bm_m" ON billing_milestones;
CREATE POLICY "bm_m" ON billing_milestones FOR ALL
  USING (contract_id IN (SELECT id FROM contracts WHERE org_id = public.user_org_id()));

-- Doanh thu công ty
DROP POLICY IF EXISTS re_m ON revenue_entries;
CREATE POLICY re_m ON revenue_entries FOR ALL
  USING (org_id = public.user_org_id());

-- Doanh thu nội bộ
DROP POLICY IF EXISTS ir_m ON internal_revenue;
CREATE POLICY ir_m ON internal_revenue FOR ALL
  USING (org_id = public.user_org_id());

-- Chi phí
DROP POLICY IF EXISTS ce_m ON cost_entries;
CREATE POLICY ce_m ON cost_entries FOR ALL
  USING (org_id = public.user_org_id());

SELECT '016_staff_manage_contracts_revenue: done' AS status;
