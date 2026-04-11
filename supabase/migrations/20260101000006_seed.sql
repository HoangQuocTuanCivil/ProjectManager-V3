-- ============================================================================
-- A2Z WORKHUB — DỮ LIỆU MẪU (SEED)
-- Gộp toàn bộ seed data: tổ chức, phòng ban, trung tâm, người dùng, nhóm,
-- KPI, quyền, vai trò, dự án, mục tiêu, công việc, bình luận, khoán,
-- thông báo, danh mục dịch vụ, sản phẩm dịch vụ.
-- Chạy SAU 5 file schema/functions/rls/storage/views
-- Mật khẩu mặc định: Test@2026!
-- ============================================================================

-- ─── TỔ CHỨC ─────────────────────────────────────────────────────────────────
-- Tổ chức mẫu: A2Z Engineering — đơn vị tư vấn xây dựng và BIM
INSERT INTO organizations (id, name, domain, settings)
VALUES (
  'a2a00000-0000-0000-0000-000000000001',
  'A2Z Engineering & Consulting',
  'a2z.com.vn',
  '{"timezone":"Asia/Ho_Chi_Minh","currency":"VND","kpi_cycle":"monthly"}'
) ON CONFLICT (id) DO NOTHING;

-- ─── PHÒNG BAN ───────────────────────────────────────────────────────────────
-- 3 phòng ban chính: BIM, Thiết kế, Giám sát
INSERT INTO departments (id, org_id, name, code, description, sort_order)
VALUES
  ('de000000-0000-0000-0000-000000000001', 'a2a00000-0000-0000-0000-000000000001', 'Phòng BIM',         'BIM', 'Mô hình thông tin xây dựng (BIM)',      1),
  ('de000000-0000-0000-0000-000000000002', 'a2a00000-0000-0000-0000-000000000001', 'Phòng Thiết kế',    'TK',  'Thiết kế kỹ thuật hạ tầng giao thông', 2),
  ('de000000-0000-0000-0000-000000000003', 'a2a00000-0000-0000-0000-000000000001', 'Phòng Giám sát',    'GS',  'Giám sát thi công tại hiện trường',     3)
ON CONFLICT (id) DO NOTHING;

-- Ban điều hành — phòng ban đặc biệt, nhân sự có quyền xem toàn bộ trung tâm
INSERT INTO departments (id, org_id, name, code, description, sort_order, is_executive)
VALUES (
  'de000000-0000-0000-0000-000000000099',
  'a2a00000-0000-0000-0000-000000000001',
  'Ban điều hành',
  'BDH',
  'Ban lãnh đạo - có quyền xem toàn bộ trung tâm',
  0,
  true
) ON CONFLICT (id) DO UPDATE SET is_executive = true;

-- ─── TRUNG TÂM ───────────────────────────────────────────────────────────────
-- Trung tâm kỹ thuật quản lý BIM + Thiết kế
INSERT INTO centers (id, org_id, name, code, description, sort_order)
VALUES (
  'ce000000-0000-0000-0000-000000000001',
  'a2a00000-0000-0000-0000-000000000001',
  'Trung tâm Kỹ thuật Số',
  'KTS',
  'Quản lý phòng BIM và Thiết kế',
  1
) ON CONFLICT (id) DO NOTHING;

-- Gán center cho 2 phòng BIM và Thiết kế
UPDATE departments
SET center_id = 'ce000000-0000-0000-0000-000000000001'
WHERE id IN (
  'de000000-0000-0000-0000-000000000001',
  'de000000-0000-0000-0000-000000000002'
);

-- Auth users được tạo thủ công qua Supabase Dashboard hoặc script migrate_auth_users.ps1
-- (Không thể INSERT vào auth.users qua migrations trên Supabase cloud)

-- ─── HỒ SƠ NGƯỜI DÙNG ───────────────────────────────────────────────────────
-- Tuấn: admin (Quản trị viên)
INSERT INTO users (id, org_id, dept_id, center_id, full_name, email, role, job_title, is_active)
VALUES
  ('00e00000-0000-0000-0000-000000000001','a2a00000-0000-0000-0000-000000000001','de000000-0000-0000-0000-000000000001','ce000000-0000-0000-0000-000000000001','Hoàng Quốc Tuấn','hoangquoctuan1395@gmail.com','admin','Quản trị viên', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Gán trưởng phòng cho từng phòng ban
UPDATE departments SET head_user_id = '00e00000-0000-0000-0000-000000000001'
  WHERE id = 'de000000-0000-0000-0000-000000000001';
UPDATE departments SET head_user_id = '00e00000-0000-0000-0000-000000000001'
  WHERE id = 'de000000-0000-0000-0000-000000000002';

-- Gán giám đốc trung tâm
UPDATE centers SET director_id = '00e00000-0000-0000-0000-000000000001'
  WHERE id = 'ce000000-0000-0000-0000-000000000001';

-- ─── NHÓM (Teams) ────────────────────────────────────────────────────────────
-- Nhóm Revit thuộc phòng BIM, do Tuấn dẫn
INSERT INTO teams (id, org_id, dept_id, name, code, description, leader_id, is_active)
VALUES (
  'ee000000-0000-0000-0000-000000000001',
  'a2a00000-0000-0000-0000-000000000001',
  'de000000-0000-0000-0000-000000000001',
  'Nhóm Revit', 'REV', 'Mô hình kết cấu & MEP bằng Revit',
  '00e00000-0000-0000-0000-000000000001', TRUE
) ON CONFLICT (id) DO NOTHING;

-- Cập nhật team_id cho admin
UPDATE users SET team_id = 'ee000000-0000-0000-0000-000000000001'
  WHERE id = '00e00000-0000-0000-0000-000000000001';

-- ─── CẤU HÌNH KPI & KHOÁN ────────────────────────────────────────────────────
-- Bộ trọng số KPI mặc định cho tổ chức
INSERT INTO kpi_configs (id, org_id, progress_weight, ontime_weight, volume_weight)
VALUES ('ca000000-0000-0000-0000-000000000001','a2a00000-0000-0000-0000-000000000001', 0.50, 0.30, 0.20)
ON CONFLICT (id) DO NOTHING;

-- Bộ trọng số chia khoán 4 chiều (V+Q+D+A = 1.0)
INSERT INTO allocation_configs (id, org_id, name, weight_volume, weight_quality, weight_difficulty, weight_ahead)
VALUES ('cb000000-0000-0000-0000-000000000001','a2a00000-0000-0000-0000-000000000001','Cấu hình mặc định', 0.40, 0.30, 0.20, 0.10)
ON CONFLICT (id) DO NOTHING;

-- ─── QUYỀN HỆ THỐNG ──────────────────────────────────────────────────────────
-- Danh sách quyền cơ bản — được sử dụng bởi custom roles
INSERT INTO permissions (id, group_name, name, description, sort_order) VALUES
  ('task.view_self',        'Công việc',  'Xem task của mình',          'Xem tasks được giao cho mình',              1),
  ('task.view_dept',        'Công việc',  'Xem task phòng ban',         'Xem tất cả task trong phòng',               2),
  ('task.view_all',         'Công việc',  'Xem tất cả task',            'Xem task toàn tổ chức',                     3),
  ('task.create',           'Công việc',  'Tạo task',                   'Tạo và giao công việc mới',                 4),
  ('task.edit_others',      'Công việc',  'Sửa task người khác',        'Chỉnh sửa task không phải của mình',        5),
  ('task.update_progress',  'Công việc',  'Cập nhật tiến độ',           'Cập nhật % tiến độ task',                   6),
  ('task.score_kpi',        'Công việc',  'Chấm điểm KPI',              'Nhập điểm KPI thực tế khi nghiệm thu',      7),
  ('task.approve',          'Công việc',  'Duyệt / nghiệm thu task',    'Phê duyệt và nghiệm thu công việc',         8),
  ('task.delete',           'Công việc',  'Xóa task',                   'Xóa công việc',                             9),
  ('task.view_team',        'Công việc',  'Xem task team',              'Xem task của nhóm mình phụ trách',          10),
  ('project.view_all',      'Dự án',      'Xem tất cả dự án',           'Truy cập danh sách dự án',                  20),
  ('project.create',        'Dự án',      'Tạo dự án',                  'Tạo dự án mới',                             21),
  ('project.edit',          'Dự án',      'Sửa thông tin dự án',        'Cập nhật thông tin dự án',                  22),
  ('project.manage_members','Dự án',      'Quản lý thành viên dự án',   'Thêm/xóa thành viên dự án',                 23),
  ('kpi.view_self',         'KPI',        'Xem KPI của mình',           'Xem điểm KPI cá nhân',                      30),
  ('kpi.view_dept',         'KPI',        'Xem KPI phòng ban',          'Xem KPI của cả phòng',                      31),
  ('kpi.view_company',      'KPI',        'Xem KPI toàn công ty',       'Xem KPI tổng hợp tổ chức',                  32),
  ('kpi.config',            'KPI',        'Cấu hình KPI',               'Sửa bộ trọng số KPI',                       33),
  ('kpi.create_period',     'KPI',        'Tạo đợt khoán',              'Tạo và quản lý đợt chia khoán',             34),
  ('goals.create',          'Mục tiêu',   'Tạo mục tiêu',               'Tạo Goal/OKR mới',                          40),
  ('goals.view_all',        'Mục tiêu',   'Xem tất cả mục tiêu',        'Xem Goal của toàn tổ chức',                 41),
  ('goals.manage',          'Mục tiêu',   'Quản lý mục tiêu',           'Sửa và xóa Goal',                           42),
  ('settings.users',        'Cài đặt',    'Quản lý người dùng',         'Thêm/sửa/xóa tài khoản',                   50),
  ('settings.depts',        'Cài đặt',    'Quản lý phòng ban',          'Quản lý cơ cấu tổ chức',                    51),
  ('settings.templates',    'Cài đặt',    'Quản lý mẫu',                'Tạo/sửa task template',                     52),
  ('settings.workflows',    'Cài đặt',    'Quản lý workflow',           'Cấu hình quy trình duyệt',                  53),
  ('settings.security',     'Cài đặt',    'Bảo mật',                    'Cấu hình bảo mật hệ thống',                 54)
ON CONFLICT (id) DO NOTHING;

-- ─── VAI TRÒ TÙY CHỈNH ──────────────────────────────────────────────────────
-- BIM Manager (mở rộng từ head) và Senior Engineer (mở rộng từ staff)
INSERT INTO custom_roles (id, org_id, name, description, color, base_role)
VALUES
  ('cc000000-0000-0000-0000-000000000001','a2a00000-0000-0000-0000-000000000001','BIM Manager',    'Nhóm trưởng BIM nâng cao', '#3b82f6','head'),
  ('cc000000-0000-0000-0000-000000000002','a2a00000-0000-0000-0000-000000000001','Senior Engineer','Kỹ sư cao cấp',             '#10b981','staff')
ON CONFLICT (id) DO NOTHING;

-- Quyền BIM Manager: xem dept, tạo/sửa task, chấm KPI, quản lý dự án, goals
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('cc000000-0000-0000-0000-000000000001','task.view_dept'),
  ('cc000000-0000-0000-0000-000000000001','task.create'),
  ('cc000000-0000-0000-0000-000000000001','task.edit_others'),
  ('cc000000-0000-0000-0000-000000000001','task.score_kpi'),
  ('cc000000-0000-0000-0000-000000000001','task.approve'),
  ('cc000000-0000-0000-0000-000000000001','project.view_all'),
  ('cc000000-0000-0000-0000-000000000001','project.edit'),
  ('cc000000-0000-0000-0000-000000000001','project.manage_members'),
  ('cc000000-0000-0000-0000-000000000001','kpi.view_dept'),
  ('cc000000-0000-0000-0000-000000000001','settings.templates'),
  ('cc000000-0000-0000-0000-000000000001','goals.create'),
  ('cc000000-0000-0000-0000-000000000001','goals.view_all'),
  -- Quyền Senior Engineer: xem dept, cập nhật tiến độ, chấm KPI, xem dự án
  ('cc000000-0000-0000-0000-000000000002','task.view_dept'),
  ('cc000000-0000-0000-0000-000000000002','task.update_progress'),
  ('cc000000-0000-0000-0000-000000000002','task.score_kpi'),
  ('cc000000-0000-0000-0000-000000000002','kpi.view_self'),
  ('cc000000-0000-0000-0000-000000000002','project.view_all')
ON CONFLICT DO NOTHING;

-- Gán custom role BIM Manager cho Tuấn
UPDATE users SET custom_role_id = 'cc000000-0000-0000-0000-000000000001'
  WHERE id = '00e00000-0000-0000-0000-000000000001';

-- ─── DỰ ÁN ───────────────────────────────────────────────────────────────────
-- Dự án 1: Cầu vượt Nguyễn Hữu Cảnh (BIM + tư vấn giám sát)
-- Dự án 2: Cao tốc Tân Phú - Bảo Lộc (thiết kế kỹ thuật gói XL-03)
INSERT INTO projects (id, org_id, code, name, description, dept_id, manager_id, status, budget, allocation_fund, start_date, end_date, location, client)
VALUES
  (
    'bb000000-0000-0000-0000-000000000001',
    'a2a00000-0000-0000-0000-000000000001',
    'NHC', 'Cầu vượt Nguyễn Hữu Cảnh',
    'Thiết kế BIM và giám sát thi công cầu vượt tại nút giao Nguyễn Hữu Cảnh - Tôn Đức Thắng',
    'de000000-0000-0000-0000-000000000001',
    '00e00000-0000-0000-0000-000000000001',
    'active', 250000000, 150000000,
    '2026-02-15', '2026-10-31', 'TP.HCM', 'Sở GTVT TP.HCM'
  ),
  (
    'bb000000-0000-0000-0000-000000000002',
    'a2a00000-0000-0000-0000-000000000001',
    'TPBL', 'Cao tốc Tân Phú - Bảo Lộc',
    'Tư vấn thiết kế kỹ thuật và BIM cho gói thầu XL-03 đường cao tốc Tân Phú - Bảo Lộc',
    'de000000-0000-0000-0000-000000000002',
    '00e00000-0000-0000-0000-000000000001',
    'active', 500000000, 300000000,
    '2026-01-10', '2026-12-31', 'Lâm Đồng', 'Ban QLDA Thăng Long'
  )
ON CONFLICT (id) DO NOTHING;

-- Thành viên dự án NHC
INSERT INTO project_members (project_id, user_id, role, is_active) VALUES
  ('bb000000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001','manager', TRUE)
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Thành viên dự án TPBL
INSERT INTO project_members (project_id, user_id, role, is_active) VALUES
  ('bb000000-0000-0000-0000-000000000002','00e00000-0000-0000-0000-000000000001','manager', TRUE)
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ─── MỤC TIÊU (Goals) ────────────────────────────────────────────────────────
INSERT INTO goals (id, org_id, title, goal_type, status, owner_id, dept_id, period_label, start_date, due_date, progress, color)
VALUES
  -- Mục tiêu công ty Q2/2026
  ('b0000000-0000-0000-0000-000000000001','a2a00000-0000-0000-0000-000000000001',
   'Đạt 90% KPI Q2/2026','company','on_track',
   '00e00000-0000-0000-0000-000000000001',NULL,'Q2/2026','2026-04-01','2026-06-30',35.00,'#6366f1'),
  -- Mục tiêu phòng BIM: hoàn thành 100% mô hình đúng tiến độ
  ('b0000000-0000-0000-0000-000000000002','a2a00000-0000-0000-0000-000000000001',
   'Hoàn thành 100% mô hình BIM các dự án','department','on_track',
   '00e00000-0000-0000-0000-000000000001','de000000-0000-0000-0000-000000000001','Q2/2026','2026-04-01','2026-06-30',20.00,'#3b82f6'),
  -- Mục tiêu cá nhân: review 10 plugins Revit
  ('b0000000-0000-0000-0000-000000000003','a2a00000-0000-0000-0000-000000000001',
   'Nâng cao kỹ năng Revit API','personal','at_risk',
   '00e00000-0000-0000-0000-000000000001','de000000-0000-0000-0000-000000000001','Q2/2026','2026-04-01','2026-06-30',30.00,'#f59e0b')
ON CONFLICT (id) DO NOTHING;

-- Mục tiêu phòng là sub-goal của mục tiêu công ty
UPDATE goals SET parent_goal_id = 'b0000000-0000-0000-0000-000000000001'
  WHERE id = 'b0000000-0000-0000-0000-000000000002';

-- Chỉ tiêu đo lường cho từng goal
INSERT INTO goal_targets (id, goal_id, title, target_type, current_value, target_value, unit)
VALUES
  ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Điểm KPI TB >= 85','percentage',72,85,'%'),
  ('b1000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','Tasks BIM hoàn thành','task_completion',8,50,'tasks'),
  ('b1000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000003','Review plugins Revit','number',3,10,'plugins')
ON CONFLICT (id) DO NOTHING;

-- ─── CÔNG VIỆC (Tasks) ───────────────────────────────────────────────────────
-- 10 tasks đa dạng status và KPI — đại diện cho vòng đời công việc thực tế

INSERT INTO tasks (
  id, org_id, dept_id, project_id, team_id,
  title, description, assignee_id, assigner_id,
  status, priority, task_type, kpi_weight, progress,
  expect_volume, expect_quality, expect_difficulty, expect_ahead,
  actual_volume, actual_quality, actual_difficulty, actual_ahead,
  kpi_evaluated_by, kpi_evaluated_at, kpi_note,
  start_date, deadline, completed_at,
  estimate_hours, actual_hours, health
)
VALUES
  -- Task 1: Hoàn thành + KPI đã chấm (NHC / BIM)
  ('dd000000-0000-0000-0000-000000000001','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000001','ee000000-0000-0000-0000-000000000001',
   'Mô hình địa hình khu vực nút giao NHC',
   'Tạo mô hình địa hình 3D từ dữ liệu khảo sát LIDAR và bản đồ số',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'completed','high','product',7,100,
   100,85,70,60, 95,88,75,70,
   '00e00000-0000-0000-0000-000000000001','2026-03-20 10:00:00+07','Mô hình chính xác, tiến độ tốt',
   '2026-02-20','2026-03-25','2026-03-19 17:00:00+07',32,28.5,'green'),

  -- Task 2: Đang thực hiện 65% (NHC / BIM)
  ('dd000000-0000-0000-0000-000000000002','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000001','ee000000-0000-0000-0000-000000000001',
   'Mô hình kết cấu dầm hộp cầu vượt',
   'Mô hình 3D kết cấu dầm hộp BTCT DƯL nhịp chính L=45m bằng Revit Structure',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'in_progress','high','product',8,65,
   100,90,85,50, 0,0,0,0,
   NULL,NULL,NULL,
   '2026-03-10','2026-04-20',NULL,48,30.0,'green'),

  -- Task 3: Đang thực hiện 30% (NHC / TK)
  ('dd000000-0000-0000-0000-000000000003','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000002','bb000000-0000-0000-0000-000000000001',NULL,
   'Thiết kế hệ thống thoát nước mặt cầu',
   'Thiết kế chi tiết hệ thống thu gom và thoát nước mưa trên bề mặt cầu vượt',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'in_progress','medium','product',6,30,
   100,80,60,50, 0,0,0,0,
   NULL,NULL,NULL,
   '2026-03-20','2026-04-25',NULL,20,6.0,'yellow'),

  -- Task 4: Quá hạn (NHC / GS)
  ('dd000000-0000-0000-0000-000000000004','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000003','bb000000-0000-0000-0000-000000000001',NULL,
   'Báo cáo khảo sát địa chất nền móng',
   'Lập báo cáo tổng hợp kết quả khảo sát địa chất tại 4 vị trí trụ cầu',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'overdue','urgent','task',7,50,
   100,80,65,50, 0,0,0,0,
   NULL,NULL,NULL,
   '2026-02-25','2026-03-30',NULL,24,18.0,'red'),

  -- Task 5: Chờ duyệt review (NHC / BIM)
  ('dd000000-0000-0000-0000-000000000005','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000001','ee000000-0000-0000-0000-000000000001',
   'Clash detection mô hình MEP vs kết cấu',
   'Kiểm tra va chạm giữa hệ thống MEP và kết cấu trên mô hình BIM tổng hợp',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'review','high','task',6,100,
   100,85,70,60, 0,0,0,0,
   NULL,NULL,NULL,
   '2026-03-15','2026-04-05',NULL,12,11.0,'green'),

  -- Task 6: Hoàn thành + KPI đã chấm (TPBL / TK)
  ('dd000000-0000-0000-0000-000000000006','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000002','bb000000-0000-0000-0000-000000000002',NULL,
   'TK bình đồ tuyến Km12 - Km18',
   'Thiết kế bình đồ tuyến đường cao tốc đoạn Km12 đến Km18 qua địa hình đồi núi',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'completed','high','product',8,100,
   100,85,75,60, 100,82,70,55,
   '00e00000-0000-0000-0000-000000000001','2026-03-15 14:00:00+07','Đạt yêu cầu, cần chỉnh sửa nhỏ curve radius tại Km15',
   '2026-02-01','2026-03-20','2026-03-14 16:30:00+07',40,36.0,'green'),

  -- Task 7: Đang thực hiện 55% (TPBL / TK)
  ('dd000000-0000-0000-0000-000000000007','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000002','bb000000-0000-0000-0000-000000000002',NULL,
   'TK trắc dọc và trắc ngang Km12 - Km18',
   'Thiết kế mặt cắt dọc và mặt cắt ngang điển hình cho 6km đường cao tốc',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'in_progress','high','product',7,55,
   100,80,70,50, 0,0,0,0,
   NULL,NULL,NULL,
   '2026-03-15','2026-04-30',NULL,36,18.0,'green'),

  -- Task 8: Đang thực hiện 20% (TPBL / BIM)
  ('dd000000-0000-0000-0000-000000000008','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000002','ee000000-0000-0000-0000-000000000001',
   'Mô hình BIM cầu vượt Km14+500',
   'Mô hình 3D kết cấu cầu vượt tại lý trình Km14+500 gồm mố, trụ, dầm I',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'in_progress','medium','product',8,20,
   100,85,80,50, 0,0,0,0,
   NULL,NULL,NULL,
   '2026-03-25','2026-05-15',NULL,56,10.0,'green'),

  -- Task 9: Chưa bắt đầu (TPBL / TK)
  ('dd000000-0000-0000-0000-000000000009','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000002','bb000000-0000-0000-0000-000000000002',NULL,
   'Thiết kế hệ thống thoát nước dọc tuyến',
   'Thiết kế rãnh, cống hộp, cống tròn cho hệ thống thoát nước dọc tuyến Km12-Km18',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'pending','medium','task',5,0,
   100,75,55,50, 0,0,0,0,
   NULL,NULL,NULL,
   NULL,'2026-05-20',NULL,24,NULL,'gray'),

  -- Task 10: Quá hạn nghiêm trọng (TPBL / GS)
  ('dd000000-0000-0000-0000-000000000010','a2a00000-0000-0000-0000-000000000001',
   'de000000-0000-0000-0000-000000000003','bb000000-0000-0000-0000-000000000002',NULL,
   'Báo cáo đánh giá tác động môi trường gói XL-03',
   'Lập báo cáo ĐTM cho đoạn tuyến qua khu vực rừng phòng hộ tại Km15-Km17',
   '00e00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'overdue','urgent','task',9,40,
   100,85,70,60, 0,0,0,0,
   NULL,NULL,NULL,
   '2026-02-10','2026-03-25',NULL,40,22.0,'red')

ON CONFLICT (id) DO NOTHING;

-- ─── BÌNH LUẬN CÔNG VIỆC ─────────────────────────────────────────────────────
-- Minh họa luồng trao đổi thực tế giữa leader và staff
INSERT INTO task_comments (task_id, user_id, content, created_at) VALUES
  ('dd000000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001','Đã hoàn thành mô hình địa hình, gửi anh review.','2026-03-18 16:00:00+07'),
  ('dd000000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001','Mô hình tốt, merge vào model tổng hợp.','2026-03-19 09:00:00+07'),
  ('dd000000-0000-0000-0000-000000000002','00e00000-0000-0000-0000-000000000001','Đang mô hình dầm hộp tiết diện thay đổi, khá phức tạp.','2026-04-01 10:00:00+07'),
  ('dd000000-0000-0000-0000-000000000004','00e00000-0000-0000-0000-000000000001','Đang chờ kết quả thí nghiệm SPT hố khoan BH-03.','2026-03-28 08:00:00+07'),
  ('dd000000-0000-0000-0000-000000000004','00e00000-0000-0000-0000-000000000001','Cần đẩy nhanh tiến độ, báo cáo đã quá hạn.','2026-04-01 09:00:00+07'),
  ('dd000000-0000-0000-0000-000000000006','00e00000-0000-0000-0000-000000000001','Hoàn thành bình đồ, gửi chị Hương review.','2026-03-14 15:00:00+07'),
  ('dd000000-0000-0000-0000-000000000007','00e00000-0000-0000-0000-000000000001','Đã xong trắc dọc, đang làm trắc ngang điển hình.','2026-04-02 11:00:00+07'),
  ('dd000000-0000-0000-0000-000000000010','00e00000-0000-0000-0000-000000000001','Khó khăn do cần phối hợp với Sở TN&MT Lâm Đồng.','2026-03-20 14:00:00+07'),
  ('dd000000-0000-0000-0000-000000000010','00e00000-0000-0000-0000-000000000001','Liên hệ anh Hải bên Sở TNMT để hỗ trợ.','2026-03-21 08:00:00+07')
ON CONFLICT DO NOTHING;

-- ─── ĐỢT KHOÁN (Allocation Period) ──────────────────────────────────────────
-- Đợt khoán tháng 3/2026 cho dự án NHC — trạng thái draft chờ tính
INSERT INTO allocation_periods (id, org_id, config_id, name, project_id, total_fund, period_start, period_end, mode, status)
VALUES (
  'ab000000-0000-0000-0000-000000000001',
  'a2a00000-0000-0000-0000-000000000001',
  'cb000000-0000-0000-0000-000000000001',
  'Khoán tháng 3/2026 - NHC',
  'bb000000-0000-0000-0000-000000000001',
  80000000, '2026-03-01', '2026-03-31',
  'per_project', 'draft'
) ON CONFLICT (id) DO NOTHING;

-- ─── THÔNG BÁO MẪU ──────────────────────────────────────────────────────────
-- Minh họa các loại notification thực tế trong hệ thống
INSERT INTO notifications (org_id, user_id, title, body, type, is_read, created_at) VALUES
  ('a2a00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'Bạn được giao công việc mới',
   'CV: Mô hình kết cấu dầm hộp cầu vượt | KPI kỳ vọng: 74.5 | W:8/10',
   'task_assigned',FALSE,'2026-03-10 08:00:00+07'),
  ('a2a00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'Công việc quá hạn',
   'CV: Báo cáo địa chất nền móng đã quá hạn 5 ngày (deadline: 30/03/2026)',
   'task_overdue',FALSE,'2026-04-04 07:00:00+07'),
  ('a2a00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'Công việc cần duyệt',
   'CV: Clash detection MEP vs kết cấu — Khoa đã hoàn thành, chờ nghiệm thu.',
   'workflow_pending',FALSE,'2026-04-03 09:00:00+07'),
  ('a2a00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'KPI đã được nghiệm thu',
   'CV: Mô hình địa hình NHC | Điểm KPI: 83.8 (Kỳ vọng: 79, +4.8)',
   'kpi_evaluated',TRUE,'2026-03-20 10:05:00+07'),
  ('a2a00000-0000-0000-0000-000000000001','00e00000-0000-0000-0000-000000000001',
   'Đợt khoán mới được tạo',
   'Khoán tháng 3/2026 - NHC (80,000,000 VNĐ) đang chờ tính toán.',
   'system',FALSE,'2026-04-01 08:00:00+07')
ON CONFLICT DO NOTHING;

-- ─── DANH MỤC SẢN PHẨM / DỊCH VỤ ───────────────────────────────────────────
-- 5 loại hình dịch vụ tư vấn xây dựng
INSERT INTO product_service_categories (org_id, slug, name, color, sort_order)
SELECT o.id, v.slug, v.name, v.color, v.sort_order
FROM organizations o,
(VALUES
  ('design',      'Thiết kế',  'bg-blue-500/10 text-blue-600',     1),
  ('consulting',  'Tư vấn',    'bg-purple-500/10 text-purple-600', 2),
  ('survey',      'Khảo sát',  'bg-amber-500/10 text-amber-600',   3),
  ('supervision', 'Giám sát',  'bg-green-500/10 text-green-600',   4),
  ('other',       'Khác',      'bg-gray-500/10 text-gray-600',     5)
) AS v(slug, name, color, sort_order)
ON CONFLICT DO NOTHING;

-- ─── SẢN PHẨM / DỊCH VỤ MẪU ────────────────────────────────────────────────
-- 5 dịch vụ tư vấn phổ biến
INSERT INTO product_services (org_id, code, name, category, unit_price, description)
SELECT
  o.id, v.code, v.name, v.category, v.price, v.description
FROM (SELECT id FROM organizations LIMIT 1) o,
(VALUES
  ('TK-KTRUC', 'Thiết kế Kiến trúc',  'design',      0, 'Thiết kế kiến trúc công trình'),
  ('TV-GSAT',  'Tư vấn Giám sát',     'supervision', 0, 'Tư vấn giám sát thi công'),
  ('KS-DHINH', 'Khảo sát Địa hình',   'survey',      0, 'Khảo sát địa hình, địa chất'),
  ('TK-KCAU',  'Thiết kế Kết cấu',    'design',      0, 'Thiết kế kết cấu công trình'),
  ('TV-TTRA',  'Tư vấn Thẩm tra',     'consulting',  0, 'Tư vấn thẩm tra thiết kế')
) AS v(code, name, category, price, description)
ON CONFLICT ON CONSTRAINT uq_ps_org_code DO NOTHING;
