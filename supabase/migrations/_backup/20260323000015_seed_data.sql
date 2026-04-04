-- Migration 015: Seed Data

-- Organization
INSERT INTO organizations (id, name, domain) VALUES
  ('a2a00000-0000-0000-0000-000000000001', 'A2Z Construction Consulting JSC', 'a2z.com.vn');

-- Departments
INSERT INTO departments (id, org_id, name, code, sort_order) VALUES
  ('de000000-0000-0000-0000-000000000001', 'a2a00000-0000-0000-0000-000000000001', 'Trung tâm BIM & CNST', 'BIM', 1),
  ('de000000-0000-0000-0000-000000000002', 'a2a00000-0000-0000-0000-000000000001', 'Phòng Thiết kế', 'TK', 2),
  ('de000000-0000-0000-0000-000000000003', 'a2a00000-0000-0000-0000-000000000001', 'Phòng Giám sát', 'GS', 3);

-- KPI & Allocation Config
INSERT INTO kpi_configs (org_id) VALUES ('a2a00000-0000-0000-0000-000000000001');
INSERT INTO allocation_configs (org_id, name, weight_volume, weight_quality, weight_difficulty, weight_ahead) VALUES
  ('a2a00000-0000-0000-0000-000000000001', 'Cấu hình mặc định', 0.40, 0.30, 0.20, 0.10);

-- Sample Projects
INSERT INTO projects (org_id, code, name, allocation_fund, status, start_date, end_date, location, client) VALUES
  ('a2a00000-0000-0000-0000-000000000001', 'CHP', 'Cầu Hồng Phong', 80000000, 'active', '2026-01-15', '2026-06-30', 'Bình Định', 'Ban QLDA 85'),
  ('a2a00000-0000-0000-0000-000000000001', 'QL1A-KM45', 'Đường QL1A Km45', 120000000, 'active', '2026-02-01', '2026-12-31', 'Khánh Hòa', 'Sở GTVT'),
  ('a2a00000-0000-0000-0000-000000000001', 'CDN', 'Cầu Đại Ninh', 60000000, 'active', '2026-03-01', '2026-09-30', 'Lâm Đồng', 'Ban QLDA ĐTXD');

-- Permissions
INSERT INTO permissions (id, group_name, name, sort_order) VALUES
  ('task.view_all','Công việc','Xem tất cả tasks',1),('task.view_dept','Công việc','Xem tasks phòng',2),
  ('task.view_self','Công việc','Xem tasks cá nhân',3),('task.create','Công việc','Tạo / giao việc',4),
  ('task.edit_others','Công việc','Sửa task người khác',5),('task.delete','Công việc','Xóa task',6),
  ('task.update_progress','Công việc','Cập nhật tiến độ',7),('task.score_kpi','Công việc','Chấm điểm KPI',8),
  ('task.approve','Công việc','Duyệt task',9),
  ('project.create','Dự án','Tạo dự án',10),('project.edit','Dự án','Sửa dự án',11),
  ('project.view_all','Dự án','Xem tất cả DA',12),('project.manage_members','Dự án','Quản lý thành viên DA',13),
  ('kpi.view_company','KPI','Xem KPI công ty',14),('kpi.view_dept','KPI','Xem KPI phòng',15),
  ('kpi.view_self','KPI','Xem KPI cá nhân',16),('kpi.config','KPI','Cấu hình trọng số',17),
  ('kpi.create_period','KPI','Tạo đợt khoán',18),('kpi.approve_alloc','KPI','Duyệt khoán',19),
  ('settings.users','Cài đặt','Quản lý tài khoản',20),('settings.depts','Cài đặt','Cấu hình phòng ban',21),
  ('settings.workflows','Cài đặt','Tạo workflow',22),('settings.templates','Cài đặt','Quản lý templates',23),
  ('settings.audit','Cài đặt','Xem audit logs',24),('settings.security','Cài đặt','Cấu hình bảo mật',25),
  ('goals.create','Goals','Tạo mục tiêu',26),('goals.view_all','Goals','Xem goals',27),('goals.manage','Goals','Quản lý goals',28);

-- Task Templates
INSERT INTO task_templates (org_id, name, category, default_title, default_kpi_weight, default_estimate_hours, default_expect_quality, default_expect_difficulty, default_checklist, default_tags) VALUES
  ('a2a00000-0000-0000-0000-000000000001', 'Mô hình kết cấu cầu BTCT', 'BIM', 'Mô hình kết cấu [tên cầu]', 8, 40, 85, 80, '[{"title":"Checklist BIM","items":["Import survey","Tạo alignment","Mô hình mố","Mô hình trụ","Mô hình dầm","Bản mặt cầu","Clash detection","Export IFC"]}]', '["Revit","BIM","Cầu"]'),
  ('a2a00000-0000-0000-0000-000000000001', 'Thiết kế MCCN đường', 'Thiết kế', 'MCCN [tên đường] Km[x]-Km[y]', 6, 24, 80, 60, '[{"title":"Checklist MCCN","items":["TCVN","Nền đường","Áo đường","Rãnh thoát nước","Bảng 10-14","Xuất bản vẽ"]}]', '["Civil3D","TCVN","Đường"]'),
  ('a2a00000-0000-0000-0000-000000000001', 'Review code plugin Revit API', 'Dev', 'Review [tên plugin]', 7, 16, 90, 85, '[{"title":"Code Review","items":["Unit tests","Code style","Memory leak","Error handling","Docs","Benchmark"]}]', '["C#","Revit API"]');

-- Project Templates
INSERT INTO project_templates (org_id, name, category, default_tasks, default_milestones) VALUES
  ('a2a00000-0000-0000-0000-000000000001', 'Dự án cầu BTCT tiêu chuẩn', 'Cầu',
   '[{"title":"Khảo sát hiện trạng","offset_days":0,"kpi_weight":5,"duration":14},{"title":"Mô hình địa hình","offset_days":7,"kpi_weight":6,"duration":10},{"title":"TK sơ bộ mố M1/M2","offset_days":14,"kpi_weight":7,"duration":21},{"title":"TK sơ bộ trụ","offset_days":14,"kpi_weight":7,"duration":21},{"title":"TK dầm chủ","offset_days":28,"kpi_weight":9,"duration":28},{"title":"Mô hình BIM","offset_days":35,"kpi_weight":8,"duration":35},{"title":"Clash detection","offset_days":63,"kpi_weight":6,"duration":7},{"title":"Xuất bản vẽ TC","offset_days":70,"kpi_weight":8,"duration":14},{"title":"Lập dự toán","offset_days":77,"kpi_weight":7,"duration":14}]',
   '[{"title":"Hoàn thành TKCS","offset_days":35},{"title":"Hoàn thành BIM","offset_days":63},{"title":"Phát hành TKKT","offset_days":90}]');

-- Org Settings
INSERT INTO org_settings (org_id, category, key, value, description) VALUES
  ('a2a00000-0000-0000-0000-000000000001','general','company_name','"A2Z Construction Consulting JSC"','Tên công ty'),
  ('a2a00000-0000-0000-0000-000000000001','general','timezone','"Asia/Ho_Chi_Minh"','Múi giờ'),
  ('a2a00000-0000-0000-0000-000000000001','general','language','"vi"','Ngôn ngữ'),
  ('a2a00000-0000-0000-0000-000000000001','security','password_min_length','8','Độ dài PW tối thiểu'),
  ('a2a00000-0000-0000-0000-000000000001','security','max_login_attempts','5','Số lần sai PW tối đa'),
  ('a2a00000-0000-0000-0000-000000000001','security','session_timeout_hours','24','Session timeout'),
  ('a2a00000-0000-0000-0000-000000000001','security','mfa_required','"none"','MFA policy'),
  ('a2a00000-0000-0000-0000-000000000001','kpi','default_expect_volume','100','KPI E mặc định: KL'),
  ('a2a00000-0000-0000-0000-000000000001','kpi','default_expect_quality','80','KPI E mặc định: CL'),
  ('a2a00000-0000-0000-0000-000000000001','kpi','default_expect_difficulty','50','KPI E mặc định: ĐK'),
  ('a2a00000-0000-0000-0000-000000000001','kpi','allocation_default_mode','"per_project"','Chế độ khoán'),
  ('a2a00000-0000-0000-0000-000000000001','kpi','kpi_auto_calc_schedule','"daily"','Lịch tính KPI'),
  ('a2a00000-0000-0000-0000-000000000001','notification','email_enabled','true','Email'),
  ('a2a00000-0000-0000-0000-000000000001','notification','push_enabled','true','Push'),
  ('a2a00000-0000-0000-0000-000000000001','notification','telegram_enabled','false','Telegram'),
  ('a2a00000-0000-0000-0000-000000000001','notification','notify_task_assigned','true','Thông báo giao việc'),
  ('a2a00000-0000-0000-0000-000000000001','notification','notify_overdue','true','Thông báo quá hạn');
