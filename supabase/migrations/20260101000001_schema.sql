-- A2Z WORKHUB 
-- Chỉ chứa: enums, bảng, indexes. Không có functions/triggers/RLS/seed.

-- ============================================================
-- EXTENSIONS
-- ============================================================
-- uuid-ossp không cần thiết khi dùng gen_random_uuid() built-in
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'leader', 'director', 'head', 'team_leader', 'staff');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'review', 'completed', 'overdue', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_type AS ENUM ('task', 'product');
CREATE TYPE period_type AS ENUM ('week', 'month', 'quarter', 'year');
CREATE TYPE notification_type AS ENUM ('task_assigned','task_updated','task_overdue','task_completed','task_review','kpi_report','allocation_approved','system','workflow_pending','kpi_evaluated','task_proposal','proposal_approved','proposal_rejected');
CREATE TYPE allocation_status AS ENUM ('draft', 'calculated', 'approved', 'paid', 'rejected');
CREATE TYPE allocation_mode AS ENUM ('per_project', 'global');
CREATE TYPE project_status AS ENUM ('planning', 'active', 'paused', 'completed', 'archived');
CREATE TYPE project_member_role AS ENUM ('manager', 'leader', 'engineer', 'reviewer');
CREATE TYPE goal_type AS ENUM ('company', 'center', 'department', 'team', 'personal');
CREATE TYPE goal_status AS ENUM ('on_track', 'at_risk', 'off_track', 'achieved', 'cancelled');
CREATE TYPE target_type AS ENUM ('number', 'currency', 'percentage', 'boolean', 'task_completion');
CREATE TYPE milestone_status AS ENUM ('upcoming', 'reached', 'missed');
CREATE TYPE health_score AS ENUM ('green', 'yellow', 'red', 'gray');
CREATE TYPE dependency_type AS ENUM ('blocking', 'waiting_on', 'related');
CREATE TYPE recurrence_type AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly');
CREATE TYPE session_status AS ENUM ('active', 'expired', 'revoked');
CREATE TYPE audit_action AS ENUM ('login','logout','create','update','delete','approve','reject','export','password_change','role_change');
CREATE TYPE workflow_step_type AS ENUM ('create','assign','execute','submit','review','approve','reject','revise','calculate','notify','archive','custom');
CREATE TYPE workflow_scope AS ENUM ('global', 'department', 'project', 'task_type');

-- ============================================================
-- BẢNG CỐT LÕI
-- ============================================================

-- Tổ chức
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  domain      TEXT UNIQUE,
  logo_url    TEXT,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Phòng ban (center_id sẽ thêm FK sau khi tạo bảng centers)
CREATE TABLE departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  description   TEXT,
  head_user_id  UUID,
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, code)
);

-- Người dùng (team_id, center_id FK sẽ thêm sau khi tạo bảng teams, centers)
CREATE TABLE users (
  id                  UUID PRIMARY KEY,
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dept_id             UUID REFERENCES departments(id) ON DELETE SET NULL,
  full_name           TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  phone               TEXT,
  avatar_url          TEXT,
  role                user_role NOT NULL DEFAULT 'staff',
  job_title           TEXT,
  is_active           BOOLEAN DEFAULT TRUE,
  custom_role_id      UUID,
  invited_by          UUID,
  invited_at          TIMESTAMPTZ,
  activated_at        TIMESTAMPTZ,
  last_login          TIMESTAMPTZ,
  login_count         INT DEFAULT 0,
  failed_login_count  INT DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  settings            JSONB DEFAULT '{"notifications_email":true,"notifications_push":true,"language":"vi","theme":"system"}',
  team_id             UUID,
  center_id           UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- FK giữa departments.head_user_id và users
ALTER TABLE departments ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL;
-- FK tự tham chiếu users.invited_by
ALTER TABLE users ADD CONSTRAINT fk_user_invited FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- TRUNG TÂM (cấp trên phòng ban)
-- ============================================================
CREATE TABLE centers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT,
  description   TEXT,
  director_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, code)
);

-- Thêm cột center_id vào departments với FK
ALTER TABLE departments ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- FK users.center_id → centers
ALTER TABLE users ADD CONSTRAINT fk_user_center FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE SET NULL;

-- ============================================================
-- ĐỘI NHÓM
-- ============================================================
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dept_id     UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT,
  description TEXT,
  leader_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dept_id, name)
);

-- FK users.team_id → teams
ALTER TABLE users ADD CONSTRAINT fk_user_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================================
-- DỰ ÁN
-- ============================================================
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  dept_id         UUID REFERENCES departments(id),
  manager_id      UUID REFERENCES users(id),
  status          project_status DEFAULT 'active',
  budget          NUMERIC(15,0) DEFAULT 0,
  allocation_fund NUMERIC(15,0) DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  location        TEXT,
  client          TEXT,
  contract_no     TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, code)
);

-- Thành viên dự án
CREATE TABLE project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        project_member_role DEFAULT 'engineer',
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  is_active   BOOLEAN DEFAULT TRUE,
  UNIQUE(project_id, user_id)
);

-- Liên kết dự án - phòng ban (nhiều-nhiều)
CREATE TABLE project_departments (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dept_id    UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, dept_id)
);

-- ============================================================
-- MỤC TIÊU & OKR
-- ============================================================
CREATE TABLE goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_goal_id  UUID REFERENCES goals(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  goal_type       goal_type NOT NULL DEFAULT 'team',
  status          goal_status NOT NULL DEFAULT 'on_track',
  owner_id        UUID REFERENCES users(id),
  dept_id         UUID REFERENCES departments(id),
  period_label    TEXT,
  start_date      DATE,
  due_date        DATE,
  progress        NUMERIC(5,2) DEFAULT 0,
  progress_source TEXT DEFAULT 'manual',
  is_public       BOOLEAN DEFAULT TRUE,
  color           TEXT DEFAULT '#6366f1',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Chỉ tiêu mục tiêu
CREATE TABLE goal_targets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  target_type     target_type NOT NULL DEFAULT 'number',
  start_value     NUMERIC DEFAULT 0,
  current_value   NUMERIC DEFAULT 0,
  target_value    NUMERIC NOT NULL,
  unit            TEXT,
  is_completed    BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Liên kết mục tiêu - dự án
CREATE TABLE goal_projects (
  goal_id     UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, project_id)
);

-- ============================================================
-- CỘT MỐC
-- ============================================================
CREATE TABLE milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    DATE NOT NULL,
  status      milestone_status DEFAULT 'upcoming',
  reached_at  TIMESTAMPTZ,
  goal_id     UUID REFERENCES goals(id) ON DELETE SET NULL,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CÔNG VIỆC (kèm KPI E/A)
-- ============================================================
CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dept_id           UUID REFERENCES departments(id) ON DELETE SET NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  team_id           UUID REFERENCES teams(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  assignee_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  assigner_id       UUID NOT NULL REFERENCES users(id),
  status            task_status NOT NULL DEFAULT 'pending',
  priority          task_priority NOT NULL DEFAULT 'medium',
  task_type         task_type NOT NULL DEFAULT 'task',
  kpi_weight        INT NOT NULL DEFAULT 5 CHECK (kpi_weight BETWEEN 1 AND 10),
  progress          INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  -- KPI kỳ vọng (TP nhập khi giao)
  expect_volume     INT DEFAULT 100 CHECK (expect_volume BETWEEN 0 AND 100),
  expect_quality    INT DEFAULT 80  CHECK (expect_quality BETWEEN 0 AND 100),
  expect_difficulty INT DEFAULT 50  CHECK (expect_difficulty BETWEEN 0 AND 100),
  expect_ahead      INT DEFAULT 50  CHECK (expect_ahead BETWEEN 0 AND 100),
  -- KPI thực tế (hệ thống + TP chấm khi nghiệm thu)
  actual_volume     INT DEFAULT 0 CHECK (actual_volume BETWEEN 0 AND 100),
  actual_quality    INT DEFAULT 0 CHECK (actual_quality BETWEEN 0 AND 100),
  actual_difficulty INT DEFAULT 0 CHECK (actual_difficulty BETWEEN 0 AND 100),
  actual_ahead      INT DEFAULT 0 CHECK (actual_ahead BETWEEN 0 AND 100),
  -- Điểm tự tính
  expect_score      NUMERIC(5,2) GENERATED ALWAYS AS (expect_volume*0.40+expect_quality*0.30+expect_difficulty*0.20+expect_ahead*0.10) STORED,
  actual_score      NUMERIC(5,2) GENERATED ALWAYS AS (actual_volume*0.40+actual_quality*0.30+actual_difficulty*0.20+actual_ahead*0.10) STORED,
  kpi_variance      NUMERIC(5,2) GENERATED ALWAYS AS ((actual_volume*0.40+actual_quality*0.30+actual_difficulty*0.20+actual_ahead*0.10)-(expect_volume*0.40+expect_quality*0.30+expect_difficulty*0.20+expect_ahead*0.10)) STORED,
  -- Đánh giá KPI
  kpi_evaluated_by  UUID REFERENCES users(id),
  kpi_evaluated_at  TIMESTAMPTZ,
  kpi_note          TEXT,
  -- Ngày tháng
  start_date        DATE,
  deadline          DATE,
  completed_at      TIMESTAMPTZ,
  -- Phân cấp & liên kết
  parent_task_id    UUID REFERENCES tasks(id) ON DELETE SET NULL,
  milestone_id      UUID REFERENCES milestones(id) ON DELETE SET NULL,
  goal_id           UUID REFERENCES goals(id) ON DELETE SET NULL,
  allocation_id     UUID,
  template_id       UUID,
  -- Theo dõi thời gian
  estimate_hours    NUMERIC(6,1),
  actual_hours      NUMERIC(6,1),
  -- Trạng thái sức khỏe & lặp lại
  health            health_score DEFAULT 'gray',
  is_milestone      BOOLEAN DEFAULT FALSE,
  is_recurring      BOOLEAN DEFAULT FALSE,
  recurrence        recurrence_type,
  recurrence_end    DATE,
  -- Dữ liệu mở rộng
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ĐỀ XUẤT CÔNG VIỆC
-- ============================================================
CREATE TABLE task_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proposed_by   UUID NOT NULL REFERENCES users(id),
  approver_id   UUID NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  description   TEXT,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  dept_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id       UUID REFERENCES teams(id) ON DELETE SET NULL,
  priority      task_priority DEFAULT 'medium',
  task_type     task_type DEFAULT 'task',
  kpi_weight    INT DEFAULT 5 CHECK (kpi_weight BETWEEN 1 AND 10),
  start_date    DATE,
  deadline      DATE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason TEXT,
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BẢNG LIÊN QUAN CÔNG VIỆC
-- ============================================================

-- Bình luận
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Đính kèm
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  storage_type TEXT DEFAULT 'supabase',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lịch sử trạng thái
CREATE TABLE task_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES users(id),
  old_status task_status,
  new_status task_status NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chấm điểm
CREATE TABLE task_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  scored_by UUID NOT NULL REFERENCES users(id),
  score_type TEXT NOT NULL CHECK (score_type IN ('quality','difficulty')),
  score_value INT NOT NULL CHECK (score_value BETWEEN 0 AND 100),
  comment TEXT,
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, score_type, scored_by)
);

-- Phụ thuộc giữa các task
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type dependency_type NOT NULL DEFAULT 'blocking',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, depends_on_id),
  CHECK(task_id != depends_on_id)
);

-- Danh sách kiểm tra
CREATE TABLE task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Checklist',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mục kiểm tra
CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES task_checklists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_checked BOOLEAN DEFAULT FALSE,
  assignee_id UUID REFERENCES users(id),
  due_date DATE,
  sort_order INT DEFAULT 0,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chấm công theo giờ
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  description TEXT,
  is_billable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KPI & CHIA KHOÁN
-- ============================================================

-- Cấu hình KPI
CREATE TABLE kpi_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  progress_weight NUMERIC(3,2) DEFAULT 0.50,
  ontime_weight NUMERIC(3,2) DEFAULT 0.30,
  volume_weight NUMERIC(3,2) DEFAULT 0.20,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id)
);

-- Cấu hình chia khoán (trọng số 4 chiều)
CREATE TABLE allocation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Cấu hình mặc định',
  weight_volume NUMERIC(4,2) NOT NULL DEFAULT 0.40,
  weight_quality NUMERIC(4,2) NOT NULL DEFAULT 0.30,
  weight_difficulty NUMERIC(4,2) NOT NULL DEFAULT 0.20,
  weight_ahead NUMERIC(4,2) NOT NULL DEFAULT 0.10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_weights CHECK (ABS(weight_volume+weight_quality+weight_difficulty+weight_ahead-1.0)<0.01),
  UNIQUE(org_id, name)
);

-- Đợt chia khoán — giao về trung tâm (center_id)
-- mode per_project: chia khoán riêng cho 1 dự án, chỉ NV tham gia DA đó được chia
-- mode global: gộp quỹ nhiều DA, nhân hệ số khó per project cho KPI từng người
CREATE TABLE allocation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES allocation_configs(id),
  center_id UUID REFERENCES centers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  dept_id UUID REFERENCES departments(id),
  total_fund NUMERIC(15,0) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  mode allocation_mode NOT NULL DEFAULT 'per_project',
  status allocation_status NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK tasks.allocation_id → allocation_periods
ALTER TABLE tasks ADD CONSTRAINT fk_task_alloc FOREIGN KEY (allocation_id) REFERENCES allocation_periods(id) ON DELETE SET NULL;

-- Kết quả chia khoán
CREATE TABLE allocation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES allocation_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  mode allocation_mode NOT NULL DEFAULT 'per_project',
  avg_volume NUMERIC(5,2) DEFAULT 0,
  avg_quality NUMERIC(5,2) DEFAULT 0,
  avg_difficulty NUMERIC(5,2) DEFAULT 0,
  avg_ahead NUMERIC(5,2) DEFAULT 0,
  weighted_score NUMERIC(7,2) DEFAULT 0,
  share_percentage NUMERIC(5,4) DEFAULT 0,
  allocated_amount NUMERIC(15,0) DEFAULT 0,
  task_count INT DEFAULT 0,
  breakdown JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, user_id)
);

-- Giao khoán ngân sách cho trung tâm hoặc phòng ban
-- Một dự án có thể giao cho nhiều trung tâm/phòng ban cùng lúc.
-- Giao cho trung tâm: set center_id, dept_id = NULL
-- Giao cho phòng ban: set dept_id, center_id = NULL (hoặc cả 2 nếu PB thuộc TT)
CREATE TABLE dept_budget_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  dept_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  center_id UUID REFERENCES centers(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  delivery_progress NUMERIC(5,2) DEFAULT 0
    CONSTRAINT chk_delivery_progress CHECK (delivery_progress BETWEEN 0 AND 100),
  delivery_date DATE,
  allocation_code TEXT,
  task_document_url TEXT,
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_budget_target CHECK (dept_id IS NOT NULL OR center_id IS NOT NULL)
);

-- Bản ghi KPI theo kỳ
CREATE TABLE kpi_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  dept_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  period period_type NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tasks_assigned INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_overdue INT DEFAULT 0,
  tasks_on_time INT DEFAULT 0,
  score NUMERIC(5,2) DEFAULT 0,
  breakdown JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (user_id, period, period_start)
);

-- Tổng hợp KPI theo dự án
CREATE TABLE project_kpi_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period period_type NOT NULL,
  period_start DATE NOT NULL,
  tasks_total INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_overdue INT DEFAULT 0,
  total_kpi_weight INT DEFAULT 0,
  avg_volume NUMERIC(5,2) DEFAULT 0,
  avg_quality NUMERIC(5,2) DEFAULT 0,
  avg_difficulty NUMERIC(5,2) DEFAULT 0,
  avg_ahead NUMERIC(5,2) DEFAULT 0,
  kpi_score NUMERIC(5,2) DEFAULT 0,
  breakdown JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id, period, period_start)
);

-- Tổng hợp KPI toàn cầu
CREATE TABLE global_kpi_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period period_type NOT NULL,
  period_start DATE NOT NULL,
  projects_count INT DEFAULT 0,
  tasks_total INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_overdue INT DEFAULT 0,
  avg_volume NUMERIC(5,2) DEFAULT 0,
  avg_quality NUMERIC(5,2) DEFAULT 0,
  avg_difficulty NUMERIC(5,2) DEFAULT 0,
  avg_ahead NUMERIC(5,2) DEFAULT 0,
  kpi_score NUMERIC(5,2) DEFAULT 0,
  project_breakdown JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id, period, period_start)
);

-- ============================================================
-- THÔNG BÁO
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type notification_type NOT NULL DEFAULT 'system',
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- XÁC THỰC & BẢO MẬT
-- ============================================================

-- Phiên đăng nhập
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB DEFAULT '{}',
  status session_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Nhật ký kiểm toán
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action audit_action NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lời mời người dùng
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  dept_id UUID REFERENCES departments(id),
  invited_by UUID NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHÂN QUYỀN & VAI TRÒ TÙY CHỈNH
-- ============================================================

-- Danh sách quyền
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0
);

-- Vai trò tùy chỉnh
CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  base_role user_role NOT NULL DEFAULT 'staff',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

-- FK users.custom_role_id → custom_roles
ALTER TABLE users ADD CONSTRAINT fk_user_custom_role FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE SET NULL;

-- Gán quyền cho vai trò
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope TEXT DEFAULT 'all',
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- HỆ THỐNG WORKFLOW
-- ============================================================

-- Mẫu workflow
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  scope workflow_scope NOT NULL DEFAULT 'global',
  dept_id UUID REFERENCES departments(id),
  project_id UUID REFERENCES projects(id),
  task_type_filter task_type,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  version INT DEFAULT 1,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

-- Bước workflow
CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  step_type workflow_step_type NOT NULL,
  assigned_role user_role,
  assigned_custom_role UUID REFERENCES custom_roles(id),
  assigned_user_id UUID REFERENCES users(id),
  is_automatic BOOLEAN DEFAULT FALSE,
  transition_condition JSONB DEFAULT '{}',
  sla_hours INT,
  sla_action TEXT,
  on_complete_actions JSONB DEFAULT '[]',
  color TEXT,
  sort_order INT DEFAULT 0,
  UNIQUE(template_id, step_order)
);

-- Chuyển tiếp giữa các bước
CREATE TABLE workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  from_step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  to_step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  condition_type TEXT DEFAULT 'always',
  condition_expr JSONB DEFAULT '{}',
  label TEXT,
  UNIQUE(from_step_id, to_step_id)
);

-- Trạng thái workflow hiện tại của task
CREATE TABLE task_workflow_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE UNIQUE,
  template_id UUID NOT NULL REFERENCES workflow_templates(id),
  current_step_id UUID NOT NULL REFERENCES workflow_steps(id),
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  result TEXT,
  note TEXT
);

-- Lịch sử workflow
CREATE TABLE workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow_steps(id),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES users(id),
  note TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MẪU, BIỂU MẪU, DASHBOARD, CẬP NHẬT TRẠNG THÁI
-- ============================================================

-- Mẫu công việc
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  default_title TEXT,
  default_priority task_priority DEFAULT 'medium',
  default_type task_type DEFAULT 'task',
  default_kpi_weight INT DEFAULT 5,
  default_estimate_hours NUMERIC(6,1),
  default_expect_quality INT DEFAULT 80,
  default_expect_difficulty INT DEFAULT 50,
  default_checklist JSONB DEFAULT '[]',
  default_tags JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mẫu dự án
CREATE TABLE project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  default_tasks JSONB DEFAULT '[]',
  default_milestones JSONB DEFAULT '[]',
  default_phases JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Biểu mẫu nhập liệu
CREATE TABLE intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_project_id UUID REFERENCES projects(id),
  target_dept_id UUID REFERENCES departments(id),
  auto_assign_to UUID REFERENCES users(id),
  default_priority task_priority DEFAULT 'medium',
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  submission_count INT DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bài nộp biểu mẫu
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES intake_forms(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES users(id),
  data JSONB NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cập nhật trạng thái dự án/mục tiêu
CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  health health_score NOT NULL DEFAULT 'green',
  highlights JSONB DEFAULT '[]',
  blockers JSONB DEFAULT '[]',
  next_steps JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  author_id UUID NOT NULL REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (project_id IS NOT NULL OR goal_id IS NOT NULL)
);

-- Bảng điều khiển
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id),
  is_shared BOOLEAN DEFAULT FALSE,
  layout JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Widget bảng điều khiển
CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  title TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  position JSONB NOT NULL DEFAULT '{}',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TỰ ĐỘNG HÓA
-- ============================================================

-- Quy tắc tự động
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  project_id UUID REFERENCES projects(id),
  is_active BOOLEAN DEFAULT TRUE,
  run_count INT DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nhật ký tự động hóa
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  trigger_data JSONB,
  actions_executed JSONB,
  success BOOLEAN DEFAULT TRUE,
  error TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CÀI ĐẶT TỔ CHỨC
-- ============================================================
CREATE TABLE org_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, category, key)
);

-- ============================================================
-- INDEXES (gộp tất cả từ 30 migration)
-- ============================================================

-- Tasks
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id) WHERE status NOT IN ('completed','cancelled');
CREATE INDEX idx_tasks_dept_status ON tasks(dept_id, status);
CREATE INDEX idx_tasks_org_status ON tasks(org_id, status);
CREATE INDEX idx_tasks_project ON tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_tasks_deadline ON tasks(deadline) WHERE status NOT IN ('completed','cancelled');
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_allocation ON tasks(allocation_id) WHERE allocation_id IS NOT NULL;
CREATE INDEX idx_tasks_search ON tasks USING gin(title gin_trgm_ops);
CREATE INDEX idx_tasks_dashboard ON tasks(org_id, dept_id, status, assignee_id) INCLUDE (title, priority, progress, deadline, kpi_weight);
CREATE INDEX idx_tasks_overdue ON tasks(deadline, status) WHERE status IN ('pending','in_progress','review') AND deadline IS NOT NULL;
CREATE INDEX idx_tasks_kpi_eval ON tasks(kpi_evaluated_at) WHERE kpi_evaluated_at IS NOT NULL;
CREATE INDEX idx_tasks_goal ON tasks(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX idx_tasks_health ON tasks(health) WHERE health IN ('yellow','red');
CREATE INDEX idx_tasks_team_id ON tasks(team_id);

-- Bình luận, đính kèm, lịch sử
CREATE INDEX idx_comments_task ON task_comments(task_id, created_at);
CREATE INDEX idx_attachments_task ON task_attachments(task_id);
CREATE INDEX idx_status_logs_task ON task_status_logs(task_id, changed_at DESC);
CREATE INDEX idx_scores_task ON task_scores(task_id, score_type);
CREATE INDEX idx_deps_task ON task_dependencies(task_id);
CREATE INDEX idx_deps_depends ON task_dependencies(depends_on_id);
CREATE INDEX idx_checklists_task ON task_checklists(task_id);
CREATE INDEX idx_checklist_items ON checklist_items(checklist_id, sort_order);
CREATE INDEX idx_time_task ON time_entries(task_id, start_time DESC);
CREATE INDEX idx_time_user ON time_entries(user_id, start_time DESC);

-- KPI
CREATE INDEX idx_kpi_user ON kpi_records(user_id, period, period_start DESC);
CREATE INDEX idx_kpi_dept ON kpi_records(dept_id, period, period_start DESC);
CREATE INDEX idx_pkpi ON project_kpi_summary(project_id, user_id, period, period_start DESC);
CREATE INDEX idx_gkpi ON global_kpi_summary(org_id, user_id, period, period_start DESC);

-- Chia khoán
CREATE INDEX idx_alloc_periods ON allocation_periods(org_id, status, period_start DESC);
CREATE INDEX idx_alloc_results ON allocation_results(period_id, weighted_score DESC);
CREATE INDEX idx_alloc_results_user ON allocation_results(user_id, calculated_at DESC);
CREATE INDEX idx_dept_budget_alloc ON dept_budget_allocations(project_id);
-- Mỗi PB chỉ được giao 1 lần per dự án; mỗi TT chỉ được giao 1 lần per dự án
CREATE UNIQUE INDEX uq_budget_project_dept ON dept_budget_allocations(project_id, COALESCE(contract_id, '00000000-0000-0000-0000-000000000000'), dept_id)
  WHERE dept_id IS NOT NULL;
CREATE UNIQUE INDEX uq_budget_project_center ON dept_budget_allocations(project_id, COALESCE(contract_id, '00000000-0000-0000-0000-000000000000'), center_id)
  WHERE center_id IS NOT NULL;

-- Thông báo
CREATE INDEX idx_notif_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

-- Dự án
CREATE INDEX idx_projects_org ON projects(org_id, status);
CREATE INDEX idx_pm_user ON project_members(user_id, is_active);
CREATE INDEX idx_pm_project ON project_members(project_id, is_active);

-- Mục tiêu
CREATE INDEX idx_goals_org ON goals(org_id, goal_type, status);
CREATE INDEX idx_goals_parent ON goals(parent_goal_id) WHERE parent_goal_id IS NOT NULL;
CREATE INDEX idx_goal_targets ON goal_targets(goal_id);

-- Cột mốc
CREATE INDEX idx_milestones ON milestones(project_id, due_date);

-- Xác thực
CREATE INDEX idx_sessions ON user_sessions(user_id, status) WHERE status = 'active';
CREATE INDEX idx_invitations ON user_invitations(token) WHERE accepted_at IS NULL;

-- Kiểm toán
CREATE INDEX idx_audit_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);

-- Workflow
CREATE INDEX idx_wf_org ON workflow_templates(org_id, is_active);
CREATE INDEX idx_wf_steps ON workflow_steps(template_id, step_order);
CREATE INDEX idx_wf_state ON task_workflow_state(task_id);
CREATE INDEX idx_wf_history ON workflow_history(task_id, created_at DESC);

-- Biểu mẫu
CREATE INDEX idx_forms ON intake_forms(org_id, is_active);
CREATE INDEX idx_form_sub ON form_submissions(form_id, created_at DESC);

-- Bảng điều khiển
CREATE INDEX idx_dash ON dashboards(org_id, owner_id);
CREATE INDEX idx_widgets ON dashboard_widgets(dashboard_id, sort_order);

-- Cài đặt
CREATE INDEX idx_settings ON org_settings(org_id, category);

-- Tự động hóa
CREATE INDEX idx_auto ON automation_rules(org_id, is_active);

-- Đội nhóm
CREATE INDEX idx_teams_dept_id ON teams(dept_id);
CREATE INDEX idx_teams_leader_id ON teams(leader_id);
CREATE INDEX idx_teams_org_id ON teams(org_id);
CREATE INDEX idx_users_team_id ON users(team_id);

-- Trung tâm
CREATE INDEX idx_centers_org ON centers(org_id);
CREATE INDEX idx_centers_director ON centers(director_id);
CREATE INDEX idx_depts_center_id ON departments(center_id);
CREATE INDEX idx_users_center_id ON users(center_id) WHERE center_id IS NOT NULL;

-- Đề xuất công việc
CREATE INDEX idx_proposals_org ON task_proposals(org_id);
CREATE INDEX idx_proposals_proposed_by ON task_proposals(proposed_by);
CREATE INDEX idx_proposals_approver ON task_proposals(approver_id, status);
CREATE INDEX idx_proposals_status ON task_proposals(status);

-- Liên kết dự án - phòng ban
CREATE INDEX idx_pd_project ON project_departments(project_id);
CREATE INDEX idx_pd_dept ON project_departments(dept_id);

-- ─── PHASE 2: LƯƠNG, KỲ KHOÁN, HỆ SỐ KHÓ ──────────────────────────────────
-- Mô hình "Lương = Ứng trước": lương hàng tháng là khoản ứng trước.
-- Cuối kỳ khoán (3/6 tháng), so sánh sản lượng vs tổng lương:
--   Sản lượng > Lương → bonus (thưởng)
--   Sản lượng < Lương → salary_deductions (trừ dần)

CREATE TYPE salary_deduction_status AS ENUM ('active', 'completed', 'cancelled');

-- Cấu hình kỳ khoán: mỗi org 1 bản ghi, chu kỳ 3 hoặc 6 tháng
CREATE TABLE allocation_cycle_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_months INT NOT NULL DEFAULT 3
    CONSTRAINT chk_cycle_months CHECK (cycle_months IN (3, 6)),
  start_month  INT NOT NULL DEFAULT 1
    CONSTRAINT chk_start_month CHECK (start_month BETWEEN 1 AND 12),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cycle_config_org UNIQUE (org_id)
);

-- Bảng lương hàng tháng: ghi nhận lương ứng trước cho từng nhân viên
-- net_salary = base_salary − deduction_applied (computed column)
CREATE TABLE salary_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id),
  dept_id           UUID REFERENCES departments(id) ON DELETE SET NULL,
  month             DATE NOT NULL,
  base_salary       NUMERIC(15,0) NOT NULL DEFAULT 0,
  deduction_applied NUMERIC(15,0) NOT NULL DEFAULT 0
    CONSTRAINT chk_deduction_non_negative CHECK (deduction_applied >= 0),
  net_salary        NUMERIC(15,0) GENERATED ALWAYS AS (base_salary - deduction_applied) STORED,
  notes             TEXT,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_salary_user_month UNIQUE (org_id, user_id, month)
);

-- Khấu trừ lương: phát sinh khi sản lượng < lương, trừ dần hàng tháng
CREATE TABLE salary_deductions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id),
  period_id         UUID NOT NULL REFERENCES allocation_periods(id) ON DELETE CASCADE,
  total_amount      NUMERIC(15,0) NOT NULL DEFAULT 0
    CONSTRAINT chk_deduction_total_positive CHECK (total_amount > 0),
  remaining_amount  NUMERIC(15,0) NOT NULL DEFAULT 0
    CONSTRAINT chk_remaining_non_negative CHECK (remaining_amount >= 0),
  monthly_deduction NUMERIC(15,0) NOT NULL DEFAULT 0
    CONSTRAINT chk_monthly_positive CHECK (monthly_deduction > 0),
  status            salary_deduction_status NOT NULL DEFAULT 'active',
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_deduction_user_period UNIQUE (user_id, period_id)
);

-- Mở rộng allocation_results: liên kết kết quả khoán với dữ liệu lương
ALTER TABLE allocation_results
  ADD COLUMN total_salary_paid NUMERIC(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN bonus_amount      NUMERIC(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN deduction_id      UUID REFERENCES salary_deductions(id) ON DELETE SET NULL;

-- Hệ số khó: điều chỉnh mức đóng góp PB trong dự án (>1.0 = khó hơn, <1.0 = dễ hơn)
CREATE TABLE project_dept_factors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dept_id           UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  difficulty_factor NUMERIC(4,2) NOT NULL DEFAULT 1.00
    CONSTRAINT chk_factor_positive CHECK (difficulty_factor > 0),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_dept_factor UNIQUE (project_id, dept_id)
);

CREATE INDEX idx_salary_org      ON salary_records (org_id, month DESC);
CREATE INDEX idx_salary_user     ON salary_records (user_id, month);
CREATE INDEX idx_salary_dept     ON salary_records (dept_id, month DESC) WHERE dept_id IS NOT NULL;
CREATE INDEX idx_deduction_org   ON salary_deductions (org_id, status);
CREATE INDEX idx_deduction_user  ON salary_deductions (user_id, status);
CREATE INDEX idx_deduction_period ON salary_deductions (period_id);
CREATE INDEX idx_deduction_active ON salary_deductions (user_id, created_at)
  WHERE status = 'active' AND remaining_amount > 0;
CREATE INDEX idx_alloc_results_deduction ON allocation_results (deduction_id)
  WHERE deduction_id IS NOT NULL;
CREATE INDEX idx_pdf_project ON project_dept_factors (project_id);
CREATE INDEX idx_pdf_dept    ON project_dept_factors (dept_id);

-- Đảm bảo Supabase roles có quyền truy cập schema public
-- (cần thiết khi schema được tạo lại sau DROP CASCADE)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

SELECT '✅ 001_schema: Tất cả bảng, enum, index đã tạo xong' AS status;

