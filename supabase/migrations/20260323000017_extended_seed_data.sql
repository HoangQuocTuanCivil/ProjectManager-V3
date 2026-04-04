-- Migration 017: Extended Seed Data — Users, Tasks, Goals, Workflows, etc.
-- Org ID: a2a00000-0000-0000-0000-000000000001 (từ migration 015)
-- Dept BIM: de000000-0000-0000-0000-000000000001
-- Dept TK:  de000000-0000-0000-0000-000000000002
-- Dept GS:  de000000-0000-0000-0000-000000000003

-- 1. USERS (6 users — cần tạo auth.users trước)

-- Tạo auth users (Supabase local dev — password: "Test@2026!")
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, email_change_confirm_status, phone, phone_change, phone_change_token, reauthentication_token)
VALUES
  ('00e00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'viet.nq@a2z.com.vn', crypt('Test@2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nguyễn Quốc Việt"}', 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', '', '', 0, NULL, '', '', ''),
  ('00e00000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'tam.tm@a2z.com.vn',  crypt('Test@2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Trần Minh Tâm"}',  'authenticated', 'authenticated', NOW(), NOW(), '', '', '', '', '', 0, NULL, '', '', ''),
  ('00e00000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'dung.lh@a2z.com.vn', crypt('Test@2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lê Hoàng Dũng"}',  'authenticated', 'authenticated', NOW(), NOW(), '', '', '', '', '', 0, NULL, '', '', ''),
  ('00e00000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'huong.pt@a2z.com.vn',crypt('Test@2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Phạm Thị Hương"}', 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', '', '', 0, NULL, '', '', ''),
  ('00e00000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'khoa.vd@a2z.com.vn', crypt('Test@2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Võ Đình Khoa"}',   'authenticated', 'authenticated', NOW(), NOW(), '', '', '', '', '', 0, NULL, '', '', ''),
  ('00e00000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'linh.dn@a2z.com.vn', crypt('Test@2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Đặng Ngọc Linh"}', 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', '', '', 0, NULL, '', '', '');

-- Tạo auth.identities (bắt buộc cho Supabase Auth flow)
INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES
  ('00e00000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000001', 'viet.nq@a2z.com.vn', 'email', '{"sub":"00e00000-0000-0000-0000-000000000001","email":"viet.nq@a2z.com.vn"}', NOW(), NOW(), NOW()),
  ('00e00000-0000-0000-0000-000000000002', '00e00000-0000-0000-0000-000000000002', 'tam.tm@a2z.com.vn',  'email', '{"sub":"00e00000-0000-0000-0000-000000000002","email":"tam.tm@a2z.com.vn"}',  NOW(), NOW(), NOW()),
  ('00e00000-0000-0000-0000-000000000003', '00e00000-0000-0000-0000-000000000003', 'dung.lh@a2z.com.vn', 'email', '{"sub":"00e00000-0000-0000-0000-000000000003","email":"dung.lh@a2z.com.vn"}', NOW(), NOW(), NOW()),
  ('00e00000-0000-0000-0000-000000000004', '00e00000-0000-0000-0000-000000000004', 'huong.pt@a2z.com.vn','email', '{"sub":"00e00000-0000-0000-0000-000000000004","email":"huong.pt@a2z.com.vn"}',NOW(), NOW(), NOW()),
  ('00e00000-0000-0000-0000-000000000005', '00e00000-0000-0000-0000-000000000005', 'khoa.vd@a2z.com.vn', 'email', '{"sub":"00e00000-0000-0000-0000-000000000005","email":"khoa.vd@a2z.com.vn"}', NOW(), NOW(), NOW()),
  ('00e00000-0000-0000-0000-000000000006', '00e00000-0000-0000-0000-000000000006', 'linh.dn@a2z.com.vn', 'email', '{"sub":"00e00000-0000-0000-0000-000000000006","email":"linh.dn@a2z.com.vn"}', NOW(), NOW(), NOW());

-- Public users table profiles
INSERT INTO users (id, org_id, dept_id, full_name, email, role, job_title, is_active) VALUES
  ('00e00000-0000-0000-0000-000000000001', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', 'Nguyễn Quốc Việt', 'viet.nq@a2z.com.vn', 'admin',  'Giám đốc kỹ thuật', TRUE),
  ('00e00000-0000-0000-0000-000000000002', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', 'Trần Minh Tâm',    'tam.tm@a2z.com.vn',  'leader', 'Trưởng phòng BIM',  TRUE),
  ('00e00000-0000-0000-0000-000000000003', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', 'Lê Hoàng Dũng',    'dung.lh@a2z.com.vn', 'head',   'Nhóm trưởng BIM',   TRUE),
  ('00e00000-0000-0000-0000-000000000004', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000002', 'Phạm Thị Hương',   'huong.pt@a2z.com.vn','head',   'Nhóm trưởng TK',    TRUE),
  ('00e00000-0000-0000-0000-000000000005', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', 'Võ Đình Khoa',     'khoa.vd@a2z.com.vn', 'staff',  'Kỹ sư BIM',         TRUE),
  ('00e00000-0000-0000-0000-000000000006', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000002', 'Đặng Ngọc Linh',   'linh.dn@a2z.com.vn', 'staff',  'Kỹ sư thiết kế',    TRUE);

-- Set department heads
UPDATE departments SET head_user_id = '00e00000-0000-0000-0000-000000000003' WHERE id = 'de000000-0000-0000-0000-000000000001';
UPDATE departments SET head_user_id = '00e00000-0000-0000-0000-000000000004' WHERE id = 'de000000-0000-0000-0000-000000000002';

-- Set project managers
UPDATE projects SET manager_id = '00e00000-0000-0000-0000-000000000001', dept_id = 'de000000-0000-0000-0000-000000000001' WHERE code = 'CHP';
UPDATE projects SET manager_id = '00e00000-0000-0000-0000-000000000002', dept_id = 'de000000-0000-0000-0000-000000000002' WHERE code = 'QL1A-KM45';
UPDATE projects SET manager_id = '00e00000-0000-0000-0000-000000000001', dept_id = 'de000000-0000-0000-0000-000000000001' WHERE code = 'CDN';
-- 2. CUSTOM ROLES

INSERT INTO custom_roles (id, org_id, name, description, color, base_role) VALUES
  ('00be0000-0000-0000-0000-000000000001', 'a2a00000-0000-0000-0000-000000000001', 'BIM Manager',     'Quản lý BIM nâng cao',    '#3b82f6', 'head'),
  ('00be0000-0000-0000-0000-000000000002', 'a2a00000-0000-0000-0000-000000000001', 'Senior Engineer',  'Kỹ sư cao cấp',           '#10b981', 'staff');

INSERT INTO role_permissions (role_id, permission_id) VALUES
  -- BIM Manager perms
  ('00be0000-0000-0000-0000-000000000001', 'task.view_dept'),
  ('00be0000-0000-0000-0000-000000000001', 'task.create'),
  ('00be0000-0000-0000-0000-000000000001', 'task.edit_others'),
  ('00be0000-0000-0000-0000-000000000001', 'task.score_kpi'),
  ('00be0000-0000-0000-0000-000000000001', 'task.approve'),
  ('00be0000-0000-0000-0000-000000000001', 'project.manage_members'),
  ('00be0000-0000-0000-0000-000000000001', 'project.view_all'),
  ('00be0000-0000-0000-0000-000000000001', 'project.edit'),
  ('00be0000-0000-0000-0000-000000000001', 'kpi.view_dept'),
  ('00be0000-0000-0000-0000-000000000001', 'settings.templates'),
  ('00be0000-0000-0000-0000-000000000001', 'goals.create'),
  ('00be0000-0000-0000-0000-000000000001', 'goals.view_all'),
  -- Senior Engineer perms
  ('00be0000-0000-0000-0000-000000000002', 'task.view_dept'),
  ('00be0000-0000-0000-0000-000000000002', 'task.update_progress'),
  ('00be0000-0000-0000-0000-000000000002', 'task.score_kpi'),
  ('00be0000-0000-0000-0000-000000000002', 'kpi.view_self'),
  ('00be0000-0000-0000-0000-000000000002', 'project.view_all');

-- Gán custom role cho Dũng (BIM Manager)
UPDATE users SET custom_role_id = '00be0000-0000-0000-0000-000000000001' WHERE id = '00e00000-0000-0000-0000-000000000003';
-- 3. PROJECT MEMBERS

-- Lấy project IDs từ code
DO $$
DECLARE
  v_chp UUID; v_ql1a UUID; v_cdn UUID;
BEGIN
  SELECT id INTO v_chp  FROM projects WHERE code = 'CHP';
  SELECT id INTO v_ql1a FROM projects WHERE code = 'QL1A-KM45';
  SELECT id INTO v_cdn  FROM projects WHERE code = 'CDN';

  INSERT INTO project_members (project_id, user_id, role, is_active) VALUES
    -- CHP
    (v_chp, '00e00000-0000-0000-0000-000000000001', 'manager',  TRUE),
    (v_chp, '00e00000-0000-0000-0000-000000000003', 'leader',   TRUE),
    (v_chp, '00e00000-0000-0000-0000-000000000005', 'engineer', TRUE),
    (v_chp, '00e00000-0000-0000-0000-000000000006', 'engineer', TRUE),
    -- QL1A
    (v_ql1a, '00e00000-0000-0000-0000-000000000002', 'manager',  TRUE),
    (v_ql1a, '00e00000-0000-0000-0000-000000000004', 'leader',   TRUE),
    (v_ql1a, '00e00000-0000-0000-0000-000000000006', 'engineer', TRUE),
    -- CDN
    (v_cdn, '00e00000-0000-0000-0000-000000000001', 'manager',  TRUE),
    (v_cdn, '00e00000-0000-0000-0000-000000000003', 'engineer', TRUE),
    (v_cdn, '00e00000-0000-0000-0000-000000000005', 'engineer', TRUE);
END $$;
-- 4. GOALS & OKR

INSERT INTO goals (id, org_id, title, description, goal_type, status, owner_id, dept_id, period_label, start_date, due_date, progress, color) VALUES
  ('00a10000-0000-0000-0000-000000000001', 'a2a00000-0000-0000-0000-000000000001',
   'Đạt 90% KPI Q2/2026', 'Mục tiêu KPI toàn công ty quý 2', 'company', 'on_track',
   '00e00000-0000-0000-0000-000000000001', NULL, 'Q2/2026', '2026-04-01', '2026-06-30', 35.00, '#6366f1'),

  ('00a10000-0000-0000-0000-000000000002', 'a2a00000-0000-0000-0000-000000000001',
   'Hoàn thành 100% mô hình BIM các dự án', 'Mục tiêu phòng BIM — hoàn thành mô hình đúng tiến độ', 'department', 'on_track',
   '00e00000-0000-0000-0000-000000000002', 'de000000-0000-0000-0000-000000000001', 'Q2/2026', '2026-04-01', '2026-06-30', 20.00, '#3b82f6'),

  ('00a10000-0000-0000-0000-000000000003', 'a2a00000-0000-0000-0000-000000000001',
   'Nâng cao kỹ năng Revit API', 'Mục tiêu cá nhân — review 10 plugins C# cho Revit', 'personal', 'at_risk',
   '00e00000-0000-0000-0000-000000000005', 'de000000-0000-0000-0000-000000000001', 'Q2/2026', '2026-04-01', '2026-06-30', 30.00, '#f59e0b');

-- Sub-goal: Department goal -> Company goal
UPDATE goals SET parent_goal_id = '00a10000-0000-0000-0000-000000000001' WHERE id = '00a10000-0000-0000-0000-000000000002';

INSERT INTO goal_targets (id, goal_id, title, target_type, start_value, current_value, target_value, unit) VALUES
  ('00a20000-0000-0000-0000-000000000001', '00a10000-0000-0000-0000-000000000001', 'Điểm KPI trung bình >= 85', 'percentage', 0, 72, 85, '%'),
  ('00a20000-0000-0000-0000-000000000002', '00a10000-0000-0000-0000-000000000002', 'Tasks BIM hoàn thành', 'task_completion', 0, 8, 50, 'tasks'),
  ('00a20000-0000-0000-0000-000000000003', '00a10000-0000-0000-0000-000000000003', 'Review 10 plugins Revit', 'number', 0, 3, 10, 'plugins');
-- 5. MILESTONES (Project CHP)

DO $$
DECLARE v_chp UUID;
BEGIN
  SELECT id INTO v_chp FROM projects WHERE code = 'CHP';

  INSERT INTO milestones (id, project_id, title, description, due_date, status, sort_order) VALUES
    ('00be1000-0000-0000-0000-000000000001', v_chp, 'Hoàn thành TKCS',    'Thiết kế cơ sở hoàn chỉnh',      '2026-02-19', 'reached', 1),
    ('00be1000-0000-0000-0000-000000000002', v_chp, 'Hoàn thành BIM',     'Mô hình BIM 3D hoàn chỉnh',       '2026-03-19', 'upcoming', 2),
    ('00be1000-0000-0000-0000-000000000003', v_chp, 'Phát hành TKKT',     'Phát hành hồ sơ thiết kế kỹ thuật','2026-04-15', 'upcoming', 3);

  -- Đánh dấu milestone 1 đã đạt
  UPDATE milestones SET reached_at = '2026-02-18' WHERE id = '00be1000-0000-0000-0000-000000000001';
END $$;
-- 6. TASKS (10 tasks với đa dạng status, KPI scores)

DO $$
DECLARE
  v_chp UUID; v_ql1a UUID; v_cdn UUID;
BEGIN
  SELECT id INTO v_chp  FROM projects WHERE code = 'CHP';
  SELECT id INTO v_ql1a FROM projects WHERE code = 'QL1A-KM45';
  SELECT id INTO v_cdn  FROM projects WHERE code = 'CDN';

  INSERT INTO tasks (id, org_id, dept_id, project_id, title, description, assignee_id, assigner_id, status, priority, task_type, kpi_weight, progress, expect_volume, expect_quality, expect_difficulty, expect_ahead, actual_quality, actual_difficulty, kpi_evaluated_by, kpi_evaluated_at, kpi_note, start_date, deadline, completed_at, estimate_hours, actual_hours, health, milestone_id) VALUES

  -- 1. Completed + KPI đã chấm
  ('0a000000-0000-0000-0000-000000000001', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', v_chp,
   'Mô hình mố M1 cầu Hồng Phong', 'Mô hình 3D kết cấu mố M1 bằng Revit Structure', '00e00000-0000-0000-0000-000000000005', '00e00000-0000-0000-0000-000000000003',
   'completed', 'high', 'product', 8, 100, 100, 85, 80, 50, 90, 85, '00e00000-0000-0000-0000-000000000002', '2026-03-10 10:00:00+07', 'Chất lượng mô hình tốt, đúng tiến độ',
   '2026-02-01', '2026-03-15', '2026-03-10 09:30:00+07', 40, 38.5, 'green', '00be1000-0000-0000-0000-000000000001'),

  -- 2. In Progress (60%)
  ('0a000000-0000-0000-0000-000000000002', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', v_chp,
   'Mô hình trụ T1 cầu Hồng Phong', 'Mô hình 3D kết cấu trụ T1 — thân trụ + mũ trụ + cọc khoan nhồi', '00e00000-0000-0000-0000-000000000005', '00e00000-0000-0000-0000-000000000003',
   'in_progress', 'high', 'product', 8, 60, 100, 85, 80, 50, NULL, NULL, NULL, NULL, NULL,
   '2026-03-01', '2026-04-15', NULL, 40, 22.0, 'green', '00be1000-0000-0000-0000-000000000002'),

  -- 3. In Progress (35%)
  ('0a000000-0000-0000-0000-000000000003', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000002', v_ql1a,
   'TK MCCN QL1A Km45-Km50', 'Thiết kế mặt cắt ngang điển hình đường QL1A đoạn Km45 đến Km50', '00e00000-0000-0000-0000-000000000006', '00e00000-0000-0000-0000-000000000004',
   'in_progress', 'medium', 'product', 6, 35, 100, 80, 60, 50, NULL, NULL, NULL, NULL, NULL,
   '2026-03-05', '2026-04-20', NULL, 24, 8.5, 'yellow', NULL),

  -- 4. Completed + KPI đã chấm
  ('0a000000-0000-0000-0000-000000000004', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', v_cdn,
   'Khảo sát hiện trạng cầu Đại Ninh', 'Khảo sát địa hình, địa chất, thuỷ văn tại vị trí cầu', '00e00000-0000-0000-0000-000000000003', '00e00000-0000-0000-0000-000000000001',
   'completed', 'medium', 'task', 5, 100, 100, 75, 50, 50, 80, 55, '00e00000-0000-0000-0000-000000000001', '2026-03-18 14:00:00+07', 'Hoàn thành đầy đủ, báo cáo rõ ràng',
   '2026-03-01', '2026-03-20', '2026-03-18 13:45:00+07', 16, 14.0, 'green', NULL),

  -- 5. Review (đang chờ duyệt)
  ('0a000000-0000-0000-0000-000000000005', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', v_chp,
   'Review plugin Revit - Export IFC', 'Review code C# plugin export IFC cho Revit 2024', '00e00000-0000-0000-0000-000000000005', '00e00000-0000-0000-0000-000000000003',
   'review', 'high', 'task', 7, 100, 100, 90, 85, 50, NULL, NULL, NULL, NULL, NULL,
   '2026-03-10', '2026-03-25', NULL, 16, 15.0, 'green', NULL),

  -- 6. Pending
  ('0a000000-0000-0000-0000-000000000006', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', v_chp,
   'Clash detection cầu Hồng Phong', 'Kiểm tra va chạm mô hình BIM: kết cấu vs MEP vs kiến trúc', '00e00000-0000-0000-0000-000000000003', '00e00000-0000-0000-0000-000000000002',
   'pending', 'urgent', 'task', 6, 0, 100, 80, 70, 50, NULL, NULL, NULL, NULL, NULL,
   NULL, '2026-04-01', NULL, 8, NULL, 'gray', '00be1000-0000-0000-0000-000000000002'),

  -- 7. Pending
  ('0a000000-0000-0000-0000-000000000007', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000002', v_ql1a,
   'Lập dự toán QL1A Km45', 'Lập dự toán chi tiết đoạn Km45-Km50 theo đơn giá Khánh Hoà 2026', '00e00000-0000-0000-0000-000000000004', '00e00000-0000-0000-0000-000000000002',
   'pending', 'medium', 'task', 7, 0, 100, 80, 65, 50, NULL, NULL, NULL, NULL, NULL,
   NULL, '2026-05-01', NULL, 32, NULL, 'gray', NULL),

  -- 8. In Progress (45%)
  ('0a000000-0000-0000-0000-000000000008', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', v_cdn,
   'Mô hình địa hình cầu Đại Ninh', 'Tạo mô hình địa hình 3D từ dữ liệu khảo sát', '00e00000-0000-0000-0000-000000000005', '00e00000-0000-0000-0000-000000000001',
   'in_progress', 'low', 'product', 6, 45, 100, 75, 55, 50, NULL, NULL, NULL, NULL, NULL,
   '2026-03-15', '2026-04-30', NULL, 20, 9.0, 'green', NULL),

  -- 9. Pending
  ('0a000000-0000-0000-0000-000000000009', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001', v_chp,
   'Xuất bản vẽ TKCS cầu Hồng Phong', 'Xuất bản vẽ 2D từ mô hình BIM — mặt bằng, mặt cắt, chi tiết', '00e00000-0000-0000-0000-000000000006', '00e00000-0000-0000-0000-000000000003',
   'pending', 'high', 'product', 8, 0, 100, 85, 75, 50, NULL, NULL, NULL, NULL, NULL,
   NULL, '2026-04-15', NULL, 24, NULL, 'gray', '00be1000-0000-0000-0000-000000000003'),

  -- 10. Overdue
  ('0a000000-0000-0000-0000-000000000010', 'a2a00000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000003', v_chp,
   'Giám sát thi công mố M1', 'Giám sát quá trình thi công mố M1 tại hiện trường', '00e00000-0000-0000-0000-000000000003', '00e00000-0000-0000-0000-000000000001',
   'overdue', 'urgent', 'task', 9, 70, 100, 80, 60, 50, NULL, NULL, NULL, NULL, NULL,
   '2026-02-15', '2026-03-15', NULL, 80, 65.0, 'red', NULL);

END $$;
-- 7. TASK COMMENTS

INSERT INTO task_comments (task_id, user_id, content, created_at) VALUES
  ('0a000000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000005', 'Đã hoàn thành mô hình mố M1, gửi anh review.', '2026-03-09 16:00:00+07'),
  ('0a000000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000003', 'Mô hình ok, cần bổ sung thêm chi tiết neo cốt thép.', '2026-03-09 17:30:00+07'),
  ('0a000000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000005', 'Đã bổ sung. Anh review lại giúp em.', '2026-03-10 08:00:00+07'),
  ('0a000000-0000-0000-0000-000000000002', '00e00000-0000-0000-0000-000000000005', 'Đang làm phần thân trụ, dự kiến xong cuối tuần.', '2026-03-20 09:00:00+07'),
  ('0a000000-0000-0000-0000-000000000010', '00e00000-0000-0000-0000-000000000003', 'Chờ nhà thầu hoàn thiện cốp pha, dự kiến trễ 1 tuần.', '2026-03-16 08:00:00+07');
-- 8. TASK ATTACHMENTS

INSERT INTO task_attachments (task_id, uploaded_by, file_name, file_url, file_size, mime_type) VALUES
  ('0a000000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000005', 'Mo_M1_CHP_rev3.rvt', '/storage/projects/CHP/Mo_M1_CHP_rev3.rvt', 52428800, 'application/octet-stream'),
  ('0a000000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000005', 'Mo_M1_screenshots.pdf', '/storage/projects/CHP/Mo_M1_screenshots.pdf', 2097152, 'application/pdf'),
  ('0a000000-0000-0000-0000-000000000004', '00e00000-0000-0000-0000-000000000003', 'Bao_cao_khao_sat_CDN.docx', '/storage/projects/CDN/Bao_cao_khao_sat_CDN.docx', 5242880, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
-- 9. TASK CHECKLISTS & ITEMS

INSERT INTO task_checklists (id, task_id, title, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', 'Checklist BIM Mố M1', 1),
  ('c0000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000002', 'Checklist BIM Trụ T1', 1);

INSERT INTO checklist_items (checklist_id, content, is_checked, sort_order, checked_at) VALUES
  -- Checklist Mố M1 (all done)
  ('c0000000-0000-0000-0000-000000000001', 'Import survey data',        TRUE,  1, '2026-02-05 10:00:00+07'),
  ('c0000000-0000-0000-0000-000000000001', 'Tạo alignment',             TRUE,  2, '2026-02-08 15:00:00+07'),
  ('c0000000-0000-0000-0000-000000000001', 'Mô hình bệ mố',            TRUE,  3, '2026-02-15 11:00:00+07'),
  ('c0000000-0000-0000-0000-000000000001', 'Mô hình thân mố',          TRUE,  4, '2026-02-22 14:00:00+07'),
  ('c0000000-0000-0000-0000-000000000001', 'Mô hình tường cánh',       TRUE,  5, '2026-02-28 09:00:00+07'),
  ('c0000000-0000-0000-0000-000000000001', 'Chi tiết cốt thép',        TRUE,  6, '2026-03-05 16:00:00+07'),
  ('c0000000-0000-0000-0000-000000000001', 'Clash detection',           TRUE,  7, '2026-03-08 10:00:00+07'),
  ('c0000000-0000-0000-0000-000000000001', 'Export IFC',                TRUE,  8, '2026-03-09 14:00:00+07'),
  -- Checklist Trụ T1 (partial)
  ('c0000000-0000-0000-0000-000000000002', 'Mô hình cọc khoan nhồi',   TRUE,  1, '2026-03-10 11:00:00+07'),
  ('c0000000-0000-0000-0000-000000000002', 'Mô hình bệ trụ',           TRUE,  2, '2026-03-14 15:00:00+07'),
  ('c0000000-0000-0000-0000-000000000002', 'Mô hình thân trụ',         FALSE, 3, NULL),
  ('c0000000-0000-0000-0000-000000000002', 'Mô hình mũ trụ',           FALSE, 4, NULL),
  ('c0000000-0000-0000-0000-000000000002', 'Chi tiết cốt thép',        FALSE, 5, NULL),
  ('c0000000-0000-0000-0000-000000000002', 'Export IFC',                FALSE, 6, NULL);
-- 10. TASK DEPENDENCIES

INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type) VALUES
  -- Clash detection chờ Mô hình trụ T1 hoàn thành
  ('0a000000-0000-0000-0000-000000000006', '0a000000-0000-0000-0000-000000000002', 'blocking'),
  -- Xuất bản vẽ TKCS chờ Clash detection
  ('0a000000-0000-0000-0000-000000000009', '0a000000-0000-0000-0000-000000000006', 'waiting_on'),
  -- Lập dự toán liên quan TK MCCN
  ('0a000000-0000-0000-0000-000000000007', '0a000000-0000-0000-0000-000000000003', 'related');
-- 11. TIME ENTRIES

INSERT INTO time_entries (task_id, user_id, start_time, end_time, duration_minutes, description) VALUES
  ('0a000000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000005', '2026-02-10 08:00:00+07', '2026-02-10 17:00:00+07', 480, 'Mô hình bệ mố + thân mố'),
  ('0a000000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000005', '2026-03-05 08:00:00+07', '2026-03-05 16:30:00+07', 510, 'Chi tiết cốt thép + clash detection'),
  ('0a000000-0000-0000-0000-000000000002', '00e00000-0000-0000-0000-000000000005', '2026-03-12 08:00:00+07', '2026-03-12 17:00:00+07', 480, 'Mô hình cọc + bệ trụ'),
  ('0a000000-0000-0000-0000-000000000004', '00e00000-0000-0000-0000-000000000003', '2026-03-15 07:00:00+07', '2026-03-15 16:00:00+07', 480, 'Khảo sát hiện trường ngày 1'),
  ('0a000000-0000-0000-0000-000000000004', '00e00000-0000-0000-0000-000000000003', '2026-03-16 07:00:00+07', '2026-03-16 12:00:00+07', 300, 'Khảo sát + lập báo cáo');
-- 12. WORKFLOW TEMPLATE — Quy trình duyệt sản phẩm BIM

INSERT INTO workflow_templates (id, org_id, name, description, scope, dept_id, task_type_filter, is_active, is_default, created_by) VALUES
  ('0f000000-0000-0000-0000-000000000001', 'a2a00000-0000-0000-0000-000000000001',
   'Quy trình duyệt sản phẩm BIM', 'Quy trình 5 bước: Tạo -> Thực hiện -> Nộp -> Review -> Nghiệm thu KPI',
   'department', 'de000000-0000-0000-0000-000000000001', 'product', TRUE, TRUE,
   '00e00000-0000-0000-0000-000000000002');

INSERT INTO workflow_steps (id, template_id, step_order, name, description, step_type, assigned_role, is_automatic, sla_hours, color) VALUES
  ('0f500000-0000-0000-0000-000000000001', '0f000000-0000-0000-0000-000000000001', 1, 'Tạo công việc',     'Leader tạo và giao việc',                'create',  'leader', FALSE, NULL,  '#6b7280'),
  ('0f500000-0000-0000-0000-000000000002', '0f000000-0000-0000-0000-000000000001', 2, 'Thực hiện',         'Staff thực hiện công việc',               'execute', 'staff',  FALSE, NULL,  '#3b82f6'),
  ('0f500000-0000-0000-0000-000000000003', '0f000000-0000-0000-0000-000000000001', 3, 'Nộp review',        'Staff nộp sản phẩm để review',            'submit',  'staff',  FALSE, NULL,  '#f59e0b'),
  ('0f500000-0000-0000-0000-000000000004', '0f000000-0000-0000-0000-000000000001', 4, 'Review sản phẩm',   'Head/BIM Manager kiểm tra chất lượng',    'review',  'head',   FALSE, 24,    '#8b5cf6'),
  ('0f500000-0000-0000-0000-000000000005', '0f000000-0000-0000-0000-000000000001', 5, 'Nghiệm thu KPI',    'Leader chấm điểm KPI và nghiệm thu',     'approve', 'leader', FALSE, 48,    '#10b981');

INSERT INTO workflow_transitions (template_id, from_step_id, to_step_id, condition_type, label) VALUES
  ('0f000000-0000-0000-0000-000000000001', '0f500000-0000-0000-0000-000000000001', '0f500000-0000-0000-0000-000000000002', 'always',      'Bắt đầu thực hiện'),
  ('0f000000-0000-0000-0000-000000000001', '0f500000-0000-0000-0000-000000000002', '0f500000-0000-0000-0000-000000000003', 'always',      'Nộp sản phẩm'),
  ('0f000000-0000-0000-0000-000000000001', '0f500000-0000-0000-0000-000000000003', '0f500000-0000-0000-0000-000000000004', 'always',      'Chuyển review'),
  ('0f000000-0000-0000-0000-000000000001', '0f500000-0000-0000-0000-000000000004', '0f500000-0000-0000-0000-000000000005', 'if_approved', 'Đạt -> Nghiệm thu'),
  ('0f000000-0000-0000-0000-000000000001', '0f500000-0000-0000-0000-000000000004', '0f500000-0000-0000-0000-000000000002', 'if_rejected', 'Không đạt -> Làm lại');

-- Task "Review plugin Revit" đang ở bước Review (step 4)
INSERT INTO task_workflow_state (task_id, template_id, current_step_id, entered_at) VALUES
  ('0a000000-0000-0000-0000-000000000005', '0f000000-0000-0000-0000-000000000001', '0f500000-0000-0000-0000-000000000004', '2026-03-22 09:00:00+07');

-- Workflow history
INSERT INTO workflow_history (task_id, step_id, action, actor_id, note, created_at) VALUES
  ('0a000000-0000-0000-0000-000000000005', '0f500000-0000-0000-0000-000000000001', 'completed', '00e00000-0000-0000-0000-000000000003', 'Giao việc review plugin', '2026-03-10 08:00:00+07'),
  ('0a000000-0000-0000-0000-000000000005', '0f500000-0000-0000-0000-000000000002', 'completed', '00e00000-0000-0000-0000-000000000005', 'Đã review xong code',     '2026-03-20 17:00:00+07'),
  ('0a000000-0000-0000-0000-000000000005', '0f500000-0000-0000-0000-000000000003', 'completed', '00e00000-0000-0000-0000-000000000005', 'Nộp báo cáo review',      '2026-03-21 09:00:00+07'),
  ('0a000000-0000-0000-0000-000000000005', '0f500000-0000-0000-0000-000000000004', 'entered',   '00e00000-0000-0000-0000-000000000005', NULL,                       '2026-03-22 09:00:00+07');
-- 13. ALLOCATION PERIOD (draft)

DO $$
DECLARE v_chp UUID; v_config UUID;
BEGIN
  SELECT id INTO v_chp FROM projects WHERE code = 'CHP';
  SELECT id INTO v_config FROM allocation_configs WHERE org_id = 'a2a00000-0000-0000-0000-000000000001' AND is_active = TRUE LIMIT 1;

  INSERT INTO allocation_periods (id, org_id, config_id, name, project_id, total_fund, period_start, period_end, mode, status) VALUES
    ('a00c0000-0000-0000-0000-000000000001', 'a2a00000-0000-0000-0000-000000000001', v_config,
     'Khoán tháng 3/2026 - CHP', v_chp, 80000000, '2026-03-01', '2026-03-31', 'per_project', 'draft');
END $$;
-- 14. NOTIFICATIONS (sample)

INSERT INTO notifications (org_id, user_id, title, body, type, is_read, created_at) VALUES
  ('a2a00000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000005',
   'Bạn được giao công việc mới', 'CV: Mô hình trụ T1 cầu Hồng Phong | KPI kỳ vọng: 71.50 (KL:100 CL:85 ĐK:80 VTĐ:50) | W:8/10',
   'task_assigned', FALSE, '2026-03-01 08:00:00+07'),
  ('a2a00000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000006',
   'Bạn được giao công việc mới', 'CV: TK MCCN QL1A Km45-Km50 | KPI kỳ vọng: 64.00 (KL:100 CL:80 ĐK:60 VTĐ:50) | W:6/10',
   'task_assigned', TRUE, '2026-03-05 08:00:00+07'),
  ('a2a00000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000003',
   'Công việc quá hạn', 'CV: Giám sát thi công mố M1 đã quá hạn 8 ngày (deadline: 15/03/2026)',
   'task_overdue', FALSE, '2026-03-23 07:00:00+07'),
  ('a2a00000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000002',
   'Báo cáo KPI tuần', 'KPI trung bình phòng BIM tuần 12/2026: 78.5 điểm. 3 tasks hoàn thành, 1 quá hạn.',
   'kpi_report', FALSE, '2026-03-22 08:00:00+07'),
  ('a2a00000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000001',
   'Đợt khoán mới được tạo', 'Đợt khoán tháng 3/2026 - CHP (80,000,000 VNĐ) đang chờ tính toán.',
   'system', FALSE, '2026-03-23 08:00:00+07');
-- 15. DASHBOARD (shared)

INSERT INTO dashboards (id, org_id, title, description, owner_id, is_shared) VALUES
  ('da000000-0000-0000-0000-000000000001', 'a2a00000-0000-0000-0000-000000000001',
   'Bảng điều khiển BIM', 'Dashboard tổng quan hoạt động phòng BIM',
   '00e00000-0000-0000-0000-000000000002', TRUE);

INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, config, position, sort_order) VALUES
  ('da000000-0000-0000-0000-000000000001', 'number', 'Tổng tasks đang thực hiện',
   '{"query":"tasks","filter":{"status":"in_progress","dept_id":"de000000-0000-0000-0000-000000000001"}}',
   '{"x":0,"y":0,"w":3,"h":2}', 1),
  ('da000000-0000-0000-0000-000000000001', 'kpi_ring', 'KPI trung bình phòng BIM',
   '{"metric":"avg_kpi","dept_id":"de000000-0000-0000-0000-000000000001","period":"month"}',
   '{"x":3,"y":0,"w":3,"h":2}', 2),
  ('da000000-0000-0000-0000-000000000001', 'chart', 'Tiến độ dự án',
   '{"chart_type":"bar","data_source":"projects","metric":"progress","group_by":"project_code"}',
   '{"x":0,"y":2,"w":6,"h":3}', 3);
-- 16. AUDIT LOG (sample entries)

INSERT INTO audit_logs (org_id, user_id, action, resource_type, resource_id, new_values, created_at) VALUES
  ('a2a00000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000001', 'create', 'project', (SELECT id FROM projects WHERE code='CHP'), '{"code":"CHP","name":"Cầu Hồng Phong"}', '2026-01-10 09:00:00+07'),
  ('a2a00000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000002', 'approve', 'task_kpi', '0a000000-0000-0000-0000-000000000001', '{"actual_score":85.5,"verdict":"exceeded"}', '2026-03-10 10:00:00+07'),
  ('a2a00000-0000-0000-0000-000000000001', '00e00000-0000-0000-0000-000000000001', 'login', 'user', '00e00000-0000-0000-0000-000000000001', '{}', '2026-03-23 07:30:00+07');
