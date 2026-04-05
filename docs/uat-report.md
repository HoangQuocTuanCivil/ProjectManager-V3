# UAT Report — Module Doanh thu (Revenue)

**Version:** 1.0  
**Date:** 2026-04-05  
**Environment:** Staging (Vercel Preview)  
**Tester(s):** _[Điền tên]_  
**Status:** PENDING

---

## 1. Chuẩn bị

### 1.1 Staging deployment
- [ ] Deploy branch `main` lên Vercel Preview
- [ ] Apply migration `20260101000008_revenue_enhanced.sql`
- [ ] Chạy `scripts/migrate-revenue-data.sql`
- [ ] Verify seed data: 5 SP/DV, contracts, departments

### 1.2 Test accounts

| Role | Email | Mật khẩu | Phạm vi |
|------|-------|-----------|---------|
| Admin | admin@test.com | _(staging)_ | Full CRUD + confirm/cancel |
| Director | director@test.com | _(staging)_ | Xem toàn org, phân bổ PB |
| Head | head@test.com | _(staging)_ | Xem phòng mình, chi tiết dự án |
| Staff | staff@test.com | _(staging)_ | Chỉ xem (không tạo/sửa/xóa) |

---

## 2. Test Admin/Leader

### 2.1 CRUD Doanh thu

| # | Bước | Kết quả mong đợi | PASS/FAIL | Ghi chú |
|---|------|-------------------|-----------|---------|
| 1 | Vào /revenue, nhấn "+ Ghi nhận doanh thu" | Form hiện, 4 cột: dimension, method, project, contract... | | |
| 2 | Chọn SP/DV, nhập Recognition Date, amount=50M, description | Entry tạo thành công, status=draft | | |
| 3 | Nhấn ✓ (confirm) trên entry vừa tạo | Status → confirmed, toast thông báo | | |
| 4 | Nhấn ✕ (cancel) trên entry confirmed | Status → cancelled, entry đối ứng -50M xuất hiện | | |
| 5 | Tạo entry draft → nhấn 🗑 (delete) | Entry bị xóa hoàn toàn | | |
| 6 | Thử sửa entry confirmed | Thông báo "Chỉ chỉnh sửa được bút toán nháp" | | |

### 2.2 Dashboard & Biểu đồ

| # | Bước | Kết quả mong đợi | PASS/FAIL | Ghi chú |
|---|------|-------------------|-----------|---------|
| 7 | Xem 5 KPI cards | Tổng DT, Growth %, Confirmed, Draft, Forecast hiện đúng | | |
| 8 | Chuyển group_by: tháng/quý/năm | BarChart cập nhật theo kỳ | | |
| 9 | PieChart theo nguồn | Hiện billing_milestone, acceptance, manual | | |
| 10 | LineChart xu hướng | Growth % hiện đúng, dương=xanh, âm=đỏ | | |

### 2.3 Filters

| # | Bước | Kết quả mong đợi | PASS/FAIL | Ghi chú |
|---|------|-------------------|-----------|---------|
| 11 | Filter theo status=confirmed | Chỉ hiện entries confirmed | | |
| 12 | Filter theo dimension=project | Chỉ hiện entries dimension project | | |
| 13 | Filter theo date range | Entries ngoài range không hiện | | |
| 14 | Filter theo SP/DV | Chỉ hiện entries có product_service_id tương ứng | | |
| 15 | Kết hợp nhiều filter | Kết quả giao (AND) | | |

### 2.4 Export

| # | Bước | Kết quả mong đợi | PASS/FAIL | Ghi chú |
|---|------|-------------------|-----------|---------|
| 16 | Nhấn nút Download (Excel) | File .xlsx tải về, 3 sheets: Tổng hợp, Chi tiết, Phân bổ PB | | |
| 17 | Nhấn nút Printer (PDF) | Print dialog mở, layout đúng | | |

### 2.5 Báo cáo (/revenue/reports)

| # | Bước | Kết quả mong đợi | PASS/FAIL | Ghi chú |
|---|------|-------------------|-----------|---------|
| 18 | So sánh kỳ (Period Comparison) | GroupedBarChart: kỳ trước vs hiện tại | | |
| 19 | Breakdown theo method | Bảng: acceptance / completion / time-based + progress bar | | |
| 20 | Forecast chart | Actual (solid) + Forecast (striped) bars | | |

---

## 3. Test Director

| # | Bước | Kết quả mong đợi | PASS/FAIL | Ghi chú |
|---|------|-------------------|-----------|---------|
| 21 | Vào /revenue/departments | Horizontal BarChart so sánh PB | | |
| 22 | Bảng phân bổ PB | Click row → expand chi tiết entries | | |
| 23 | Filter date range | Chart + table cập nhật | | |
| 24 | Vào /revenue/reports | Xem báo cáo theo kỳ đầy đủ | | |

---

## 4. Test Head phòng ban

| # | Bước | Kết quả mong đợi | PASS/FAIL | Ghi chú |
|---|------|-------------------|-----------|---------|
| 25 | Vào /revenue/departments | Chỉ thấy phân bổ phòng mình (RLS) | | |
| 26 | Vào /projects/[id]/revenue | Thấy entries, allocations của dự án phòng mình tham gia | | |
| 27 | Thử tạo entry | Được phép (head ≥ team_leader) | | |
| 28 | Thử confirm entry | Được phép (head ≥ head) | | |

---

## 5. Test Staff

| # | Bước | Kết quả mong đợi | PASS/FAIL | Ghi chú |
|---|------|-------------------|-----------|---------|
| 29 | Vào /revenue | Xem được danh sách, không thấy nút tạo/confirm/cancel | | |
| 30 | POST /api/revenue trực tiếp | 403 Forbidden | | |

---

## 6. SP/DV Settings

| # | Bước | Kết quả mong đợi | PASS/FAIL | Ghi chú |
|---|------|-------------------|-----------|---------|
| 31 | Admin vào Settings → Sản phẩm/Dịch vụ | Bảng 5 SP/DV seed | | |
| 32 | Tạo SP/DV mới (code, name, category) | Thêm thành công, hiện trong bảng | | |
| 33 | Sửa SP/DV (đổi tên, giá) | Cập nhật thành công | | |
| 34 | Xóa SP/DV | Soft-delete (biến mất khỏi danh sách) | | |
| 35 | Tạo SP/DV trùng code | Thông báo lỗi "Mã đã tồn tại" | | |

---

## 7. Tổng hợp feedback

### Bugs (cần sửa trước release)
| # | Mô tả | Severity | Screenshot |
|---|-------|----------|------------|
| | | | |

### Enhancements (cải thiện UX)
| # | Mô tả | Priority |
|---|-------|----------|
| | | |

### Nice-to-have (tương lai)
| # | Mô tả |
|---|-------|
| | |

---

## 8. Sign-off

| Stakeholder | Role | Ngày | Chữ ký |
|-------------|------|------|--------|
| | Admin | | |
| | Director | | |
| | Head PB | | |

**Kết luận:** _[PASS / PASS WITH CONDITIONS / FAIL]_
