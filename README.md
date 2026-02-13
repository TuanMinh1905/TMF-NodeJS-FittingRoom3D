
# Fashion CRUD — Local First (NextJS + NodeJS + MongoDB + Docker + Deploy Public)

**Mục tiêu:** Từ Project TLCN với các chức năng cơ bản với Bộ ba FE-Nuxt; BE-Next; DB-SQL

## 0) Note ghi chú cần làm
- Lưu tạm trên giao diện -> Backend gọi xử lí
- Tính phí ship ( Chức năng ship ) - Nhấn mạnh phân tích thiết kế hoàn chỉnh 
- Sau tết hoàn thiện đầy đủ chức năng 
- Từ nay tới sau Tết hoàn thiện thử đồ ảo demo ( Phải có đủ khả năng để thử đồ ). 
- Tuần đầu sau Tết phải mô phỏng thử xem model này sử dụng được không
- Trước khi cuối học kì tạo trên drive để kê khai đề tài NCKH. Đề tài là Phòng thử đồ ảo. Thầy sẽ là người xác nhận
- Làm 2 trong 1 làm là vừa KLTN vừa NCKH ( Phải tự tìm hiểu cái NCKH )
## 1) Note ghi chú đã làm

---

## 1) Tạo Database `FashionDB` (một lần)

### Cách 1: Dùng script (khuyên dùng)
- **Windows:**
```bat
scripts\sql\create-db-windows.bat
```
- **macOS/Linux:**
```bash
bash scripts/sql/create-db-unix.sh
```

### Cách 2: Chạy thủ công
```sql
IF DB_ID('FashionDB') IS NULL CREATE DATABASE FashionDB; GO
```

---
