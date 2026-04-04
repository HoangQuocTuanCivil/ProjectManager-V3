#!/usr/bin/env pwsh
# ============================================================================
# A2Z WorkHub — Data Migration Script
# Chuyển dữ liệu từ Supabase cloud cũ → Supabase cloud mới
#
# CÁCH DÙNG:
#   1. Điền DB_OLD và DB_NEW bên dưới (lấy từ Supabase → Settings → Database)
#   2. Chạy: pwsh ./supabase/migrate_data.ps1
#
# LƯU Ý:
#   - Chạy SAU khi đã setup schema mới (005 file trong migrations_consolidated/)
#   - auth.users cần export riêng qua Supabase Dashboard (xem hướng dẫn dưới)
# ============================================================================

# ─── CẤU HÌNH ────────────────────────────────────────────────────────────────
# Lấy tại: Supabase Dashboard → Project → Settings → Database → Connection string (URI)
# Format:  postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

$DB_OLD = "postgresql://postgres.[old-project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
$DB_NEW = "postgresql://postgres.[new-project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

$EXPORT_FILE = "$PSScriptRoot\data_export.sql"

# ─── KIỂM TRA pg_dump ────────────────────────────────────────────────────────
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Không tìm thấy pg_dump. Cài PostgreSQL client: https://www.postgresql.org/download/"
    exit 1
}

# ─── BẢNG CẦN MIGRATE (theo thứ tự FK) ──────────────────────────────────────
# Thứ tự quan trọng: bảng cha trước, bảng con sau
$TABLES = @(
    "organizations",
    "departments",
    "centers",          # Trung tâm (cấp trên phòng ban)
    "users",            # Cần auth.users tồn tại trước (xem bên dưới)
    "teams",            # Nhóm (thuộc phòng ban)
    "custom_roles",
    "role_permissions",
    "permissions",
    "projects",
    "project_members",
    "project_departments",
    "goals",
    "goal_targets",
    "goal_projects",
    "milestones",
    "tasks",
    "task_proposals",
    "task_comments",
    "task_attachments",
    "task_status_logs",
    "task_scores",
    "task_dependencies",
    "task_checklists",
    "checklist_items",
    "time_entries",
    "kpi_configs",
    "allocation_configs",
    "allocation_periods",
    "allocation_results",
    "kpi_records",
    "notifications",
    "user_invitations",
    "workflow_templates",
    "workflow_steps",
    "workflow_transitions",
    "task_workflow_state",
    "workflow_history",
    "task_templates",
    "intake_forms",
    "form_submissions",
    "dashboards",
    "dashboard_widgets",
    "automation_rules",
    "org_settings",
    "audit_logs"
)

# ─── BƯỚC 1: EXPORT DATA TỪ DB CŨ ───────────────────────────────────────────
Write-Host "📤 Đang export dữ liệu từ DB cũ..." -ForegroundColor Cyan

# Build -t arguments cho từng bảng
$tableArgs = $TABLES | ForEach-Object { "-t", $_ }

$pgDumpArgs = @(
    "--data-only",          # Chỉ lấy dữ liệu, không lấy schema
    "--column-inserts",     # Dùng INSERT riêng từng cột (an toàn hơn COPY)
    "--no-owner",           # Bỏ OWNER để tránh lỗi permission
    "--no-privileges",      # Bỏ GRANT/REVOKE
    "--disable-triggers"    # Tắt trigger trong lúc import (tránh cascade conflict)
) + $tableArgs + @($DB_OLD)

& pg_dump @pgDumpArgs | Out-File -FilePath $EXPORT_FILE -Encoding utf8

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Export thất bại. Kiểm tra lại connection string DB_OLD."
    exit 1
}

Write-Host "✅ Export xong → $EXPORT_FILE" -ForegroundColor Green
$fileSize = (Get-Item $EXPORT_FILE).Length / 1KB
Write-Host "   Kích thước file: $([Math]::Round($fileSize, 1)) KB"

# ─── BƯỚC 2: CHUẨN BỊ FILE TRƯỚC KHI IMPORT ─────────────────────────────────
Write-Host "`n🔧 Thêm lệnh disable/enable triggers..." -ForegroundColor Cyan

$header = @"
-- ============================================================
-- Data Migration — A2Z WorkHub
-- Exported from old Supabase project
-- Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
-- ============================================================

-- Tắt triggers để tránh conflict khi insert dữ liệu
SET session_replication_role = replica;

"@

$footer = @"

-- Bật lại triggers sau khi import xong
SET session_replication_role = DEFAULT;

SELECT '✅ Migration hoàn thành!' AS status;
"@

$originalContent = Get-Content $EXPORT_FILE -Raw
$header + $originalContent + $footer | Out-File -FilePath $EXPORT_FILE -Encoding utf8
Write-Host "✅ File đã được chuẩn bị"

# ─── BƯỚC 3: IMPORT VÀO DB MỚI ───────────────────────────────────────────────
Write-Host "`n📥 Đang import vào DB mới..." -ForegroundColor Cyan

& psql $DB_NEW -f $EXPORT_FILE

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Import thất bại. Xem log bên trên để tìm lỗi."
    exit 1
}

Write-Host "`n🎉 Migration hoàn thành!" -ForegroundColor Green
Write-Host "   File export lưu tại: $EXPORT_FILE"

# ─── HƯỚNG DẪN AUTH USERS ────────────────────────────────────────────────────
Write-Host @"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  LƯU Ý QUAN TRỌNG — AUTH USERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Supabase KHÔNG cho phép pg_dump auth.users trực tiếp.
Để migrate tài khoản đăng nhập, làm theo 1 trong 2 cách:

[Cách A — Dùng Supabase Dashboard]
  1. Vào project CŨ → Authentication → Users
  2. Export danh sách users
  3. Vào project MỚI → Authentication → Invite users (tạo lại tay)

[Cách B — Dùng Management API (tự động)]
  Chạy script: pwsh ./supabase/migrate_auth_users.ps1
  (cần SUPABASE_SERVICE_ROLE_KEY của cả 2 project)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@ -ForegroundColor Yellow
