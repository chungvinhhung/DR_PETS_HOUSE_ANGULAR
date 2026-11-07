# FE/BE đối soát dữ liệu & Order E2E — 27/10/2026

**Nhánh FE:** `feature/admin-order-management-phase1`  
**Nguồn BE:** `FE-GUIDE-ORDER-E2E-RETURN-REFUND (1)(1).md` và source `feat/foundation-v6`.  
**Trạng thái:** FE đã sửa một số điểm; **chưa kiểm chứng authenticated UAT trên Render**. Không xem document BE là bằng chứng dữ liệu MongoDB đã có.

## 1. Base URL

- Live chuẩn theo handoff mới: `https://pet-clinic-backend-a4lj.onrender.com/api/v1`.
- Cả `src/environments/environment.ts` và `environment.development.ts` đã dùng URL này; **không đổi sang `api.drpetshouse.lat`** cho đến khi BE/DevOps xác nhận custom domain + HTTPS + CORS đã hoạt động.

## 2. FE đã xử lý

- Nhân sự: bỏ chặn giả đối với `MANAGER`; sử dụng scope `assignedBranchIds` do `GET /staff` xác thực và lọc ở BE. Không gọi danh bạ tài khoản Admin-only bằng tài khoản Manager. Đọc `username` từ DTO staff nếu có.
- Order/Return/Voucher: kiểm tra `items` đúng array; 200 nhưng sai schema sẽ đi luồng lỗi thay vì giả làm danh sách rỗng.
- Refund: hiển thị rõ trạng thái `FAILED` nếu API trả về; `Hoàn cuối cùng` chỉ hiển thị khi Return `COMPLETED`.
- Admin tạo đơn: có cảnh báo đây là **bản nháp, chưa thể gửi tạo đơn thật** vì BE xác nhận POS/Admin-create là `NOT_SUPPORTED`.
- Cấu hình CI: Angular build trên push nhánh feature. Những thay đổi này không đồng nghĩa build/UAT đã PASS.

## 3. Dữ liệu BE cần xác nhận trên Render (P0)

Theo tài liệu BE, bộ test có **12 Order, 9 Voucher** và các tài khoản nhân sự. Cần BE cung cấp log đã ẩn danh từ **đúng service Render + DB đang kết nối**:

1. Tài khoản `ADMIN`: GET `/orders?limit=100`, `/vouchers?limit=20`, `/staff?limit=100`, `/order-returns?limit=100`. Báo `HTTP status`, `totalCount`, `items.length`, mã ví dụ và `correlationId`. Không gửi Authorization hay mật khẩu trong log.
2. Tài khoản `MANAGER`: dữ liệu Staff/Order/Return chỉ thuộc chi nhánh được cấp; `STAFF RECEPTIONIST` chỉ thao tác tiếp nhận/nhận hàng, không được duyệt refund.
3. Xác nhận git SHA, revision Render, DB, seed `uatSeed.js` có chạy đúng DB; đối chiếu số bản ghi sau seed và cập nhật dữ liệu tồn kho/chi nhánh.
4. Test 401, 403, 422 và response RFC 9457 riêng với `200 { items: [] }`, không trả danh sách rỗng khi phát sinh lỗi.
5. Xác nhận `/health`, CORS từ localhost và domain frontend; Render có thể phản hồi chậm do cold start. Hạn chế spam login để tránh 429.

## 4. Các điểm cần BE sửa hoặc chốt contract

| Mức | Nội dung | Bằng chứng source tham chiếu |
|---|---|---|
| **P0 security** | `GET /order-returns` và `GET /order-returns/:id` dùng `optionalAuth`; `listReturns` chưa giới hạn `MANAGER/STAFF` theo branch, `getReturnById` chỉ kiểm tra Customer. **Phải chặn ở server, lọc UI không đủ bảo mật.** | `src/modules/order/return.routes.js`, `return.service.js` |
| **P0** | Kiểm chứng seed 12 Order/9 Voucher trên MongoDB của Render. Nếu 200 items rỗng, FE không thể tự sinh bản ghi thật. | `src/seeds/uatSeed.js`, deployment |
| **P1** | `GET /vouchers` thiếu `totalCount`, `formatVoucherResponse` chưa trả `minOrderAmount/maxDiscountAmount/description` như yêu cầu UI. | `voucher.service.js` |
| **P1** | Order list cursor dựa `_id` từ bản ghi dư; cần kiểm thử trang >100 để tránh bỏ sót. | `order.service.js listOrders` |
| **P1** | `processOrderRefund` trong source hiện không sử dụng `note` từ request dù handoff mô tả có body note; cần chốt hoặc ghi audit. | `return.controller.js`, `return.service.js` |
| **NOT_SUPPORTED** | Admin tạo đơn hộ, nhận tại quầy, hoàn kho theo SKU sau hủy/xuất kho. Giữ FE ở trạng thái chỉ nhập thử, không gọi Customer checkout bằng Admin JWT. | BE handoff mục Supported / NOT_SUPPORTED |

## 5. Test nghiệm thu FE

- Login Admin → `/admin/staff`, `/admin/orders`, `/admin/vouchers`: hiển thị đúng bản ghi thật hoặc lỗi tương ứng. Không tự chế fixture.
- Login Manager → Nhân sự chỉ thuộc chi nhánh được phân quyền, không phải danh sách trống do FE chặn. **Chưa nghiệm thu Return với Manager trước khi vá scope BE.**
- Đơn UAT `ORD-UAT-01-PENDING-COD`: chỉ được xác nhận nếu API cho phép. COD giữ `PENDING` cho đến `mark-delivered`.
- Return theo `REQUESTED → PROCESSING → RECEIVED → APPROVED → COMPLETED`; lễ tân không thấy nút duyệt; `APPROVED` chưa hiện giá trị `Hoàn cuối cùng`.
- Voucher UAT: kiểm tra status, validity (hết hạn/hết lượt), quote chỉ từ hợp đồng đúng giỏ Customer; không dùng Admin JWT giả checkout.
- `npm ci && npm run build`; chạy lại UAT với cùng FE SHA và BE deploy revision trước khi merge main/develop.

> Tài liệu này không chứa tài khoản/mật khẩu demo. Chỉ QA bằng tài khoản thử nghiệm được BE cấp qua kênh nội bộ an toàn.
