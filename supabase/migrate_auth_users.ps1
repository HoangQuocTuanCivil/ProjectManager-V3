#!/usr/bin/env pwsh
# ============================================================================
# A2Z WorkHub — Migrate Auth Users (Supabase → Supabase)
# Dùng Supabase Management API để tạo lại user accounts ở project mới
#
# CÁCH DÙNG:
#   1. Điền 4 biến cấu hình bên dưới
#   2. Chạy: pwsh ./supabase/migrate_auth_users.ps1
#
# LẤY SERVICE ROLE KEY:
#   Supabase Dashboard → Project → Settings → API → service_role key
# ============================================================================

# ─── CẤU HÌNH ────────────────────────────────────────────────────────────────
$OLD_PROJECT_REF   = "your-old-project-ref"          # vd: abcdefghijklmnop
$NEW_PROJECT_REF   = "your-new-project-ref"          # vd: zyxwvutsrqponmlk
$OLD_SERVICE_KEY   = "eyJhbGci..."                   # service_role key cũ
$NEW_SERVICE_KEY   = "eyJhbGci..."                   # service_role key mới

# ─── HÀM HELPER ──────────────────────────────────────────────────────────────

# Gọi Supabase Admin API lấy danh sách users từ project cũ
function Get-SupabaseUsers($projectRef, $serviceKey) {
    $url  = "https://api.supabase.com/v1/projects/$projectRef/auth/users?page=1&per_page=1000"
    $resp = Invoke-RestMethod -Uri $url -Headers @{
        "Authorization" = "Bearer $serviceKey"
        "Content-Type"  = "application/json"
    }
    return $resp.users
}

# Tạo user mới trong project đích bằng Admin Auth API
function Create-SupabaseUser($projectRef, $serviceKey, $user) {
    $url  = "https://$projectRef.supabase.co/auth/v1/admin/users"
    $body = @{
        email             = $user.email
        email_confirm     = $true   # Bỏ qua bước verify email
        user_metadata     = $user.user_metadata
        app_metadata      = $user.app_metadata
    } | ConvertTo-Json

    try {
        $resp = Invoke-RestMethod -Uri $url -Method POST -Body $body -Headers @{
            "apikey"        = $serviceKey
            "Authorization" = "Bearer $serviceKey"
            "Content-Type"  = "application/json"
        }
        return $resp
    } catch {
        # Nếu user đã tồn tại (email trùng), bỏ qua
        if ($_.Exception.Response.StatusCode -eq 422) {
            Write-Host "   ⚠️  Đã tồn tại: $($user.email)" -ForegroundColor Yellow
            return $null
        }
        throw
    }
}

# ─── CHẠY MIGRATION ───────────────────────────────────────────────────────────

Write-Host "======================================" -ForegroundColor Cyan
Write-Host " Migrate Auth Users: Supabase → Supabase"
Write-Host "======================================" -ForegroundColor Cyan

# Bước 1: Lấy danh sách users từ project cũ
Write-Host "`n📋 Đang lấy danh sách users từ project cũ..." -ForegroundColor Cyan
$users = Get-SupabaseUsers $OLD_PROJECT_REF $OLD_SERVICE_KEY
Write-Host "   Tìm thấy $($users.Count) users"

if ($users.Count -eq 0) {
    Write-Host "❌ Không có user nào. Kiểm tra lại OLD_PROJECT_REF và OLD_SERVICE_KEY."
    exit 1
}

# Bước 2: Tạo từng user trong project mới
Write-Host "`n📥 Đang tạo users trong project mới..." -ForegroundColor Cyan

$successCount = 0
$skipCount    = 0
$failCount    = 0

# Lưu mapping ID cũ → ID mới để update public.users sau
$idMapping = @{}

foreach ($user in $users) {
    Write-Host "   → $($user.email)" -NoNewline

    $newUser = Create-SupabaseUser $NEW_PROJECT_REF $NEW_SERVICE_KEY $user

    if ($newUser) {
        # Ghi nhớ mapping: ID cũ → ID mới
        $idMapping[$user.id] = $newUser.id
        Write-Host " ✅" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host " ⏭️ (bỏ qua)" -ForegroundColor Yellow
        $idMapping[$user.id] = $user.id  # Giữ nguyên ID nếu đã tồn tại
        $skipCount++
    }
}

Write-Host "`n📊 Kết quả: $successCount tạo mới | $skipCount bỏ qua | $failCount lỗi"

# Bước 3: Xuất SQL để update public.users.id nếu ID thay đổi
$changedMappings = $idMapping.GetEnumerator() | Where-Object { $_.Key -ne $_.Value }

if ($changedMappings.Count -gt 0) {
    Write-Host "`n⚠️  Một số user có ID thay đổi — cần update public.users" -ForegroundColor Yellow
    Write-Host "   Đang tạo file patch SQL..."

    $patchSql = "-- Update public.users.id theo mapping sau khi tạo auth users mới`n"
    foreach ($mapping in $changedMappings) {
        $patchSql += "UPDATE public.users SET id = '$($mapping.Value)' WHERE id = '$($mapping.Key)';`n"
    }

    $patchFile = "$PSScriptRoot\patch_user_ids.sql"
    $patchSql | Out-File -FilePath $patchFile -Encoding utf8
    Write-Host "   ✅ Lưu tại: $patchFile"
    Write-Host "   → Chạy file này trên DB mới sau khi import data" -ForegroundColor Yellow
} else {
    Write-Host "`n✅ Tất cả ID giữ nguyên — không cần patch thêm" -ForegroundColor Green
}

Write-Host "`n🎉 Hoàn thành migrate auth users!" -ForegroundColor Green
Write-Host @"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BƯỚC TIẾP THEO:
  1. Chạy: pwsh ./supabase/migrate_data.ps1
     (export và import data từ các bảng public)
  2. Nếu có file patch_user_ids.sql → chạy trên DB mới
  3. Test đăng nhập bằng tài khoản cũ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@
