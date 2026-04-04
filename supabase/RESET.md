# Hướng dẫn Reset Database — A2Z WorkHub

Schema chuẩn được lưu trong thư mục `supabase/migrations_consolidated/` gồm **5 file**, chạy theo thứ tự sau:

| # | File | Nội dung |
|---|------|----------|
| 1 | `20260101000001_schema.sql` | Tất cả bảng, enums, indexes |
| 2 | `20260101000002_functions.sql` | Tất cả functions & triggers |
| 3 | `20260101000003_rls.sql` | Toàn bộ RLS policies |
| 4 | `20260101000004_storage.sql` | Storage buckets (task-files, avatars) |
| 5 | `20260101000005_seed_data.sql` | Dữ liệu mẫu (org, users, projects, tasks) |

---

## Cách 1 — Supabase CLI (khuyến nghị)

```bash
# Chạy từ thư mục gốc dự án
supabase db reset
```

> Supabase CLI sẽ tự động chạy các file trong `supabase/migrations/` theo thứ tự timestamp.  
> Nếu muốn dùng `migrations_consolidated/` thay thế, cần cập nhật `supabase/config.toml`.

---

## Cách 2 — Chạy tay qua Supabase Studio

1. Mở **SQL Editor** trong Supabase Dashboard
2. Copy và chạy từng file theo thứ tự 1 → 5
3. Mỗi file sẽ in ra một dòng `✅ ...` xác nhận hoàn thành

---

## Tài khoản sau khi reset

| Email | Mật khẩu | Vai trò | Quyền |
|-------|----------|---------|-------|
| `viet.nq@a2z.com.vn` | `Test@2026!` | admin | Toàn quyền |
| `tam.tm@a2z.com.vn` | `Test@2026!` | leader | Quản lý phòng BIM |
| `dung.lh@a2z.com.vn` | `Test@2026!` | head | Nhóm trưởng BIM |
| `huong.pt@a2z.com.vn` | `Test@2026!` | head | Nhóm trưởng TK |
| `khoa.vd@a2z.com.vn` | `Test@2026!` | staff | Kỹ sư BIM |
| `linh.dn@a2z.com.vn` | `Test@2026!` | staff | Kỹ sư TK |

---

## Dữ liệu mẫu được tạo

- **1 tổ chức**: A2Z Engineering & Consulting
- **3 phòng ban**: BIM, Thiết kế, Giám sát
- **1 trung tâm**: Trung tâm Kỹ thuật Số (quản lý BIM + TK)
- **1 nhóm**: Nhóm Revit (thuộc phòng BIM)
- **2 dự án**: Cầu vượt Nguyễn Hữu Cảnh (NHC) + Cao tốc Tân Phú - Bảo Lộc (TPBL)
- **10 tasks**: đủ các trạng thái (pending, in_progress, review, completed, overdue)
- Goals, notifications, allocation period mẫu

---

## Lịch sử migration (đã lưu trữ)

Các file migration cũ (30 file incremental) được lưu trong:
```
supabase/migrations/_backup/
```
Chỉ để tham khảo lịch sử, không cần chạy lại.
