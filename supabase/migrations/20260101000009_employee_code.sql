-- Mã hệ thống: mã định danh nhân sự dùng để quản lý lương, khoán
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code TEXT;

-- Đảm bảo mỗi mã hệ thống là duy nhất trong cùng tổ chức
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_code_org
  ON users (org_id, employee_code)
  WHERE employee_code IS NOT NULL;
