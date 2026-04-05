# Hướng dẫn sử dụng — Module Doanh thu

## 1. Tổng quan

Module Doanh thu cho phép ghi nhận, theo dõi và phân tích doanh thu công ty theo nhiều chiều: dự án, hợp đồng, giai đoạn, sản phẩm/dịch vụ.

### Phân quyền

| Vai trò | Xem | Tạo/Sửa | Xác nhận/Huỷ | Quản lý SP/DV |
|---------|-----|---------|--------------|---------------|
| Admin/Leader | Toàn org | ✓ | ✓ | ✓ |
| Director | Toàn org | ✓ | ✓ | ✓ |
| Head | Phòng mình | ✓ | ✓ | ✗ |
| Team Leader | Phòng mình | ✓ | ✗ | ✗ |
| Staff | Phòng mình | ✗ | ✗ | ✗ |

## 2. Ghi nhận doanh thu

### 2.1 Tạo bút toán mới

1. Vào **Doanh thu** → nhấn **+ Ghi nhận doanh thu**
2. Điền thông tin:
   - **Chiều quản trị**: Dự án / Hợp đồng / Giai đoạn / SP-DV
   - **Phương pháp**: Nghiệm thu / Tỷ lệ hoàn thành / Theo thời gian
   - **Sản phẩm/Dịch vụ**: chọn từ danh mục (tuỳ chọn)
   - **Ngày ghi nhận**: mặc định hôm nay
   - **Số tiền** và **Mô tả**: bắt buộc
3. Nhấn **Ghi nhận** → bút toán tạo với trạng thái **Nháp**

### 2.2 Quy trình xác nhận

```
Nháp → [Xác nhận] → Đã xác nhận → [Huỷ] → Đã huỷ
                                         ↳ Tạo bút toán đối ứng (-amount)
```

- **Xác nhận (✓)**: chỉ dùng cho bút toán Nháp. Sau khi xác nhận, doanh thu được tính vào tổng
- **Huỷ (✕)**: huỷ bút toán đã xác nhận. Hệ thống tự tạo bút toán đối ứng (số tiền âm)
- **Xoá (🗑)**: chỉ xoá được bút toán Nháp

### 2.3 Doanh thu tự động

Hệ thống tự tạo bút toán khi:
- **Mốc thanh toán** chuyển sang trạng thái "Đã thu" → bút toán confirmed
- **Nghiệm thu task** (KPI đánh giá + payment paid) → bút toán confirmed
- **Phụ lục hợp đồng** → bút toán draft (cần admin xác nhận)

## 3. Dashboard & Biểu đồ

### 3.1 Tab Tổng quan

- **5 KPI cards**: Tổng DT, Tăng trưởng, Đã xác nhận, Nháp, Dự báo
- **BarChart**: doanh thu theo kỳ (tháng/quý/năm)
- **PieChart**: phân bổ theo nguồn (mốc TT, nghiệm thu, thủ công)
- **LineChart**: xu hướng tăng trưởng

### 3.2 Bộ lọc

8 bộ lọc: Dự án, Hợp đồng, Phòng ban, Chiều QT, Phương pháp, Trạng thái, SP/DV, Khoảng ngày.

## 4. Phân bổ phòng ban

Vào **Doanh thu → Phân bổ PB**:
- **Horizontal BarChart**: so sánh doanh thu giữa các phòng ban
- **Bảng expandable**: click vào phòng ban → xem chi tiết từng bút toán

Tỷ lệ phân bổ tự động dựa trên giao khoán ngân sách (`dept_budget_allocations`). Nếu chưa có → chia đều.

## 5. Báo cáo

Vào **Doanh thu → Báo cáo**:
- **So sánh kỳ**: kỳ hiện tại vs kỳ trước (GroupedBarChart)
- **Breakdown theo phương pháp**: nghiệm thu / hoàn thành / thời gian
- **Dự báo**: thực tế (solid) + dự báo từ mốc thanh toán (striped)

### Xuất báo cáo
- **Excel**: nhấn 📥 → file .xlsx với 3 sheets (Tổng hợp, Chi tiết, Phân bổ PB)
- **PDF**: nhấn 🖨 → print dialog

## 6. Doanh thu dự án

Vào **Dự án → [dự án] → tab Doanh thu**:
- Progress bar: % doanh thu / giá trị hợp đồng
- 4 cards: Đã xác nhận, Số bút toán, % Hoàn thành, Điều chỉnh
- PieChart phân bổ phòng ban
- Timeline lịch sử điều chỉnh từ phụ lục
- Bảng entries của dự án

## 7. Quản lý Sản phẩm/Dịch vụ

Vào **Cài đặt → Sản phẩm/Dịch vụ**:
1. **Tạo**: nhấn + → nhập Mã, Tên, Phân loại, Đơn giá, Mô tả
2. **Sửa**: nhấn ✏ → chỉnh tên, phân loại, giá (mã không đổi)
3. **Ngừng**: nhấn 🗑 → soft-delete (ẩn khỏi danh sách, dữ liệu cũ không mất)

Phân loại: Thiết kế, Tư vấn, Khảo sát, Giám sát, Khác.
