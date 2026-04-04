-- Migration: Demo seed data — 2 dự án mới, mỗi dự án 5 task
-- Sử dụng users hiện có:
--   Việt  (admin)  00e00000-...01   |  Tâm (leader) 00e00000-...02
--   Dũng  (head)   00e00000-...03   |  Hương (head) 00e00000-...04
--   Khoa  (staff)  00e00000-...05   |  Linh (staff) 00e00000-...06

DO $$
DECLARE
  v_org   UUID := 'a2a00000-0000-0000-0000-000000000001';
  v_bim   UUID := 'de000000-0000-0000-0000-000000000001';
  v_tk    UUID := 'de000000-0000-0000-0000-000000000002';
  v_gs    UUID := 'de000000-0000-0000-0000-000000000003';

  v_viet  UUID := '00e00000-0000-0000-0000-000000000001';
  v_tam   UUID := '00e00000-0000-0000-0000-000000000002';
  v_dung  UUID := '00e00000-0000-0000-0000-000000000003';
  v_huong UUID := '00e00000-0000-0000-0000-000000000004';
  v_khoa  UUID := '00e00000-0000-0000-0000-000000000005';
  v_linh  UUID := '00e00000-0000-0000-0000-000000000006';

  v_prj1  UUID;
  v_prj2  UUID;
BEGIN

-- ══════════════════════════════════════════
-- PROJECT 1: Cầu vượt Nguyễn Hữu Cảnh
-- ══════════════════════════════════════════
INSERT INTO projects (id, org_id, code, name, description, dept_id, manager_id, status, budget, allocation_fund, start_date, end_date, location, client)
VALUES (
  'bb000000-0000-0000-0000-000000000001', v_org,
  'NHC', 'Cầu vượt Nguyễn Hữu Cảnh',
  'Thiết kế BIM và giám sát thi công cầu vượt tại nút giao Nguyễn Hữu Cảnh - Tôn Đức Thắng',
  v_bim, v_tam, 'active', 250000000, 150000000,
  '2026-02-15', '2026-10-31', 'TP.HCM', 'Sở GTVT TP.HCM'
) RETURNING id INTO v_prj1;

-- Project members
INSERT INTO project_members (project_id, user_id, role, is_active) VALUES
  (v_prj1, v_tam,   'manager',  TRUE),
  (v_prj1, v_dung,  'leader',   TRUE),
  (v_prj1, v_khoa,  'engineer', TRUE),
  (v_prj1, v_linh,  'engineer', TRUE);

-- TASK 1-1: Completed + KPI đã chấm
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  actual_volume, actual_quality, actual_difficulty, actual_ahead,
  kpi_evaluated_by, kpi_evaluated_at, kpi_note,
  start_date, deadline, completed_at, estimate_hours, actual_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000001', v_org, v_bim, v_prj1,
  'Mô hình địa hình khu vực nút giao NHC',
  'Tạo mô hình địa hình 3D từ dữ liệu khảo sát LIDAR và bản đồ số',
  v_khoa, v_dung, 'completed', 'high', 'product', 7, 100,
  100, 85, 70, 60,
  95, 88, 75, 70,
  v_tam, '2026-03-20 10:00:00+07', 'Mô hình chính xác, tiến độ tốt',
  '2026-02-20', '2026-03-25', '2026-03-19 17:00:00+07', 32, 28.5, 'green'
);

-- TASK 1-2: In Progress (65%)
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  start_date, deadline, estimate_hours, actual_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000002', v_org, v_bim, v_prj1,
  'Mô hình kết cấu dầm hộp cầu vượt',
  'Mô hình 3D kết cấu dầm hộp BTCT DƯL nhịp chính L=45m bằng Revit Structure',
  v_khoa, v_dung, 'in_progress', 'high', 'product', 8, 65,
  100, 90, 85, 50,
  '2026-03-10', '2026-04-20', 48, 30.0, 'green'
);

-- TASK 1-3: In Progress (30%)
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  start_date, deadline, estimate_hours, actual_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000003', v_org, v_tk, v_prj1,
  'Thiết kế hệ thống thoát nước mặt cầu',
  'Thiết kế chi tiết hệ thống thu gom và thoát nước mưa trên bề mặt cầu vượt',
  v_linh, v_huong, 'in_progress', 'medium', 'product', 6, 30,
  100, 80, 60, 50,
  '2026-03-20', '2026-04-25', 20, 6.0, 'yellow'
);

-- TASK 1-4: Overdue
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  start_date, deadline, estimate_hours, actual_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000004', v_org, v_gs, v_prj1,
  'Báo cáo khảo sát địa chất nền móng',
  'Lập báo cáo tổng hợp kết quả khảo sát địa chất tại 4 vị trí trụ cầu',
  v_dung, v_tam, 'overdue', 'urgent', 'task', 7, 50,
  100, 80, 65, 50,
  '2026-02-25', '2026-03-30', 24, 18.0, 'red'
);

-- TASK 1-5: Review (chờ duyệt)
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  start_date, deadline, estimate_hours, actual_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000005', v_org, v_bim, v_prj1,
  'Clash detection mô hình MEP vs kết cấu',
  'Kiểm tra va chạm giữa hệ thống MEP và kết cấu trên mô hình BIM tổng hợp',
  v_khoa, v_dung, 'review', 'high', 'task', 6, 100,
  100, 85, 70, 60,
  '2026-03-15', '2026-04-05', 12, 11.0, 'green'
);


-- ══════════════════════════════════════════
-- PROJECT 2: Đường cao tốc Tân Phú - Bảo Lộc
-- ══════════════════════════════════════════
INSERT INTO projects (id, org_id, code, name, description, dept_id, manager_id, status, budget, allocation_fund, start_date, end_date, location, client)
VALUES (
  'bb000000-0000-0000-0000-000000000002', v_org,
  'TPBL', 'Cao tốc Tân Phú - Bảo Lộc',
  'Tư vấn thiết kế kỹ thuật và BIM cho gói thầu XL-03 đường cao tốc Tân Phú - Bảo Lộc',
  v_tk, v_viet, 'active', 500000000, 300000000,
  '2026-01-10', '2026-12-31', 'Lâm Đồng', 'Ban QLDA Thăng Long'
) RETURNING id INTO v_prj2;

-- Project members
INSERT INTO project_members (project_id, user_id, role, is_active) VALUES
  (v_prj2, v_viet,  'manager',  TRUE),
  (v_prj2, v_huong, 'leader',   TRUE),
  (v_prj2, v_linh,  'engineer', TRUE),
  (v_prj2, v_khoa,  'engineer', TRUE),
  (v_prj2, v_dung,  'reviewer', TRUE);

-- TASK 2-1: Completed + KPI đã chấm
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  actual_volume, actual_quality, actual_difficulty, actual_ahead,
  kpi_evaluated_by, kpi_evaluated_at, kpi_note,
  start_date, deadline, completed_at, estimate_hours, actual_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000006', v_org, v_tk, v_prj2,
  'TK bình đồ tuyến Km12 - Km18',
  'Thiết kế bình đồ tuyến đường cao tốc đoạn Km12 đến Km18 qua địa hình đồi núi',
  v_linh, v_huong, 'completed', 'high', 'product', 8, 100,
  100, 85, 75, 60,
  100, 82, 70, 55,
  v_viet, '2026-03-15 14:00:00+07', 'Đạt yêu cầu, cần chỉnh sửa nhỏ curve radius tại Km15',
  '2026-02-01', '2026-03-20', '2026-03-14 16:30:00+07', 40, 36.0, 'green'
);

-- TASK 2-2: In Progress (55%)
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  start_date, deadline, estimate_hours, actual_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000007', v_org, v_tk, v_prj2,
  'TK trắc dọc và trắc ngang Km12 - Km18',
  'Thiết kế mặt cắt dọc và mặt cắt ngang điển hình cho 6km đường cao tốc',
  v_linh, v_huong, 'in_progress', 'high', 'product', 7, 55,
  100, 80, 70, 50,
  '2026-03-15', '2026-04-30', 36, 18.0, 'green'
);

-- TASK 2-3: In Progress (20%)
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  start_date, deadline, estimate_hours, actual_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000008', v_org, v_bim, v_prj2,
  'Mô hình BIM cầu vượt Km14+500',
  'Mô hình 3D kết cấu cầu vượt tại lý trình Km14+500 gồm mố, trụ, dầm I',
  v_khoa, v_dung, 'in_progress', 'medium', 'product', 8, 20,
  100, 85, 80, 50,
  '2026-03-25', '2026-05-15', 56, 10.0, 'green'
);

-- TASK 2-4: Pending
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  start_date, deadline, estimate_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000009', v_org, v_tk, v_prj2,
  'Thiết kế hệ thống thoát nước dọc tuyến',
  'Thiết kế rãnh, cống hộp, cống tròn cho hệ thống thoát nước dọc tuyến Km12-Km18',
  v_linh, v_huong, 'pending', 'medium', 'task', 5, 0,
  100, 75, 55, 50,
  NULL, '2026-05-20', 24, 'gray'
);

-- TASK 2-5: Overdue
INSERT INTO tasks (id, org_id, dept_id, project_id, title, description,
  assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  start_date, deadline, estimate_hours, actual_hours, health)
VALUES (
  'dd000000-0000-0000-0000-000000000010', v_org, v_gs, v_prj2,
  'Báo cáo đánh giá tác động môi trường gói XL-03',
  'Lập báo cáo ĐTM cho đoạn tuyến qua khu vực rừng phòng hộ tại Km15-Km17',
  v_dung, v_viet, 'overdue', 'urgent', 'task', 9, 40,
  100, 85, 70, 60,
  '2026-02-10', '2026-03-25', 40, 22.0, 'red'
);

-- ══════════════════════════════════════════
-- TASK COMMENTS cho các task mới
-- ══════════════════════════════════════════
INSERT INTO task_comments (task_id, user_id, content, created_at) VALUES
  ('dd000000-0000-0000-0000-000000000001', v_khoa, 'Đã hoàn thành mô hình địa hình, gửi anh review.', '2026-03-18 16:00:00+07'),
  ('dd000000-0000-0000-0000-000000000001', v_dung, 'Mô hình tốt, merge vào model tổng hợp.', '2026-03-19 09:00:00+07'),
  ('dd000000-0000-0000-0000-000000000002', v_khoa, 'Đang mô hình dầm hộp tiết diện thay đổi, khá phức tạp.', '2026-04-01 10:00:00+07'),
  ('dd000000-0000-0000-0000-000000000004', v_dung, 'Đang chờ kết quả thí nghiệm SPT hố khoan BH-03.', '2026-03-28 08:00:00+07'),
  ('dd000000-0000-0000-0000-000000000004', v_tam, 'Cần đẩy nhanh tiến độ, báo cáo đã quá hạn.', '2026-04-01 09:00:00+07'),
  ('dd000000-0000-0000-0000-000000000006', v_linh, 'Hoàn thành bình đồ, gửi chị Hương review.', '2026-03-14 15:00:00+07'),
  ('dd000000-0000-0000-0000-000000000007', v_linh, 'Đã xong trắc dọc, đang làm trắc ngang điển hình.', '2026-04-02 11:00:00+07'),
  ('dd000000-0000-0000-0000-000000000010', v_dung, 'Khó khăn do cần phối hợp với Sở TN&MT Lâm Đồng.', '2026-03-20 14:00:00+07'),
  ('dd000000-0000-0000-0000-000000000010', v_viet, 'Liên hệ anh Hải bên Sở TNMT để hỗ trợ.', '2026-03-21 08:00:00+07');

END $$;
