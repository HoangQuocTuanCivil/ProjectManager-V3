-- Task KPI scores tính theo trọng số của trung tâm mà assignee thuộc về.
-- Chuyển expect_score / actual_score / kpi_variance từ GENERATED columns
-- sang regular columns, trigger fn_calc_kpi_scores() tự tính khi insert/update.

-- 1. Xóa GENERATED columns cũ, tạo lại dạng regular
ALTER TABLE tasks DROP COLUMN IF EXISTS kpi_variance;
ALTER TABLE tasks DROP COLUMN IF EXISTS actual_score;
ALTER TABLE tasks DROP COLUMN IF EXISTS expect_score;

ALTER TABLE tasks ADD COLUMN expect_score NUMERIC(5,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN actual_score NUMERIC(5,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN kpi_variance NUMERIC(5,2) DEFAULT 0;

-- 2. Trigger: tính score theo trọng số trung tâm của assignee
CREATE OR REPLACE FUNCTION fn_calc_kpi_scores() RETURNS TRIGGER AS $$
DECLARE
  w_vol  NUMERIC := 0.40;
  w_qual NUMERIC := 0.30;
  w_diff NUMERIC := 0.20;
  w_ahd  NUMERIC := 0.10;
  v_center_id UUID;
BEGIN
  -- Lấy center_id từ assignee (người được giao task)
  IF NEW.assignee_id IS NOT NULL THEN
    SELECT center_id INTO v_center_id
    FROM users WHERE id = NEW.assignee_id;

    -- Tra cứu trọng số theo trung tâm, fallback về config toàn công ty
    IF v_center_id IS NOT NULL THEN
      SELECT weight_volume, weight_quality, weight_difficulty, weight_ahead
      INTO w_vol, w_qual, w_diff, w_ahd
      FROM allocation_configs
      WHERE org_id = NEW.org_id AND center_id = v_center_id AND is_active = true
      LIMIT 1;
    END IF;

    -- Không có config riêng → fallback config toàn công ty (center_id IS NULL)
    IF NOT FOUND OR v_center_id IS NULL THEN
      SELECT weight_volume, weight_quality, weight_difficulty, weight_ahead
      INTO w_vol, w_qual, w_diff, w_ahd
      FROM allocation_configs
      WHERE org_id = NEW.org_id AND center_id IS NULL AND is_active = true
      LIMIT 1;
    END IF;
  END IF;

  -- Tính score từ trọng số
  NEW.expect_score := ROUND(
    COALESCE(NEW.expect_volume,0) * w_vol
    + COALESCE(NEW.expect_quality,0) * w_qual
    + COALESCE(NEW.expect_difficulty,0) * w_diff
    + COALESCE(NEW.expect_ahead,0) * w_ahd, 2);

  NEW.actual_score := ROUND(
    COALESCE(NEW.actual_volume,0) * w_vol
    + COALESCE(NEW.actual_quality,0) * w_qual
    + COALESCE(NEW.actual_difficulty,0) * w_diff
    + COALESCE(NEW.actual_ahead,0) * w_ahd, 2);

  NEW.kpi_variance := NEW.actual_score - NEW.expect_score;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Đăng ký trigger (chạy SAU fn_auto_score_task để có actual_volume/ahead mới nhất)
DROP TRIGGER IF EXISTS trg_calc_kpi_scores ON tasks;
CREATE TRIGGER trg_calc_kpi_scores
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION fn_calc_kpi_scores();

-- 4. Cập nhật dữ liệu hiện có: tính lại score với trọng số mặc định
UPDATE tasks SET
  expect_score = ROUND(expect_volume*0.40 + expect_quality*0.30 + expect_difficulty*0.20 + expect_ahead*0.10, 2),
  actual_score = ROUND(actual_volume*0.40 + actual_quality*0.30 + actual_difficulty*0.20 + actual_ahead*0.10, 2),
  kpi_variance = ROUND(
    (actual_volume*0.40 + actual_quality*0.30 + actual_difficulty*0.20 + actual_ahead*0.10)
    - (expect_volume*0.40 + expect_quality*0.30 + expect_difficulty*0.20 + expect_ahead*0.10), 2)
WHERE expect_score IS NULL OR expect_score = 0;

SELECT '015_kpi_score_by_center: done' AS status;
