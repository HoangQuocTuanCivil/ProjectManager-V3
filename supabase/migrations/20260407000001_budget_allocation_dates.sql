ALTER TABLE dept_budget_allocations
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

COMMENT ON COLUMN dept_budget_allocations.start_date IS 'Ngày bắt đầu giao khoán';
COMMENT ON COLUMN dept_budget_allocations.end_date IS 'Ngày kết thúc giao khoán';
