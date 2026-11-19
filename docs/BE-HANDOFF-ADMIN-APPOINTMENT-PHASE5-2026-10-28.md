# FE → BE / Figma — Appointment Phase 5: Chi tiết, trạng thái, hủy/đổi lịch
Ngày: 2026-10-28 | Nhánh: `feature/admin-appointments-figma` | PR #33

## Mức độ xác minh
- **Đã đối chiếu Figma:** node [Lịch hẹn / Wireframe](https://www.figma.com/design/vak640d4oft2Azmhu7HoGM/WEB-2?node-id=6113-17463): tiêu đề Quản lý lịch hẹn, search, lọc trạng thái, bộ lọc 30 ngày, bảng Mã lịch / Ngày tạo / Giờ tạo / Khách hàng / Dịch vụ / Trạng thái / Thao tác, biểu tượng sửa và xóa.
- **Chưa có màn Admin Figma chi tiết/hủy/đổi lịch được xác nhận** trong nhóm hiện tại. FE dùng style Admin đã có và cần Figma chuẩn hóa các màn/modal Phase 5.
- **Source Customer:** code có PATCH `/appointments/:id/cancel`, nhưng không có bằng chứng đây là hợp đồng Admin cho Customer khác, hoặc rằng có API Admin đổi lịch/đổi trạng thái. Không dùng endpoint Customer để tự ý chỉnh lịch Admin.
- **WBS 4.3:** đổi/hủy trước 24 giờ, tối đa 2 lần đổi lịch, Manager/Admin override có audit, refund mock theo rule. Phương thức hoàn tiền và enum trạng thái đầy đủ chưa có DTO Admin được xác minh.

## FE đã bổ sung
- List: bám Figma 7 cột, status badges, chỉnh sửa → chi tiết, xóa → đề nghị hủy (không hard delete), phân trang và trạng thái lỗi/rỗng. Bộ lọc 30 ngày hiện disabled vì chưa xác minh contract ngày (không hiển thị dữ liệu đã lọc giả).
- Detail: `/admin/appointments/:id`, GET read-only `/appointments/:id` (shape truy vấn **chưa xác minh**); xử lý rõ lỗi permission / no data.
- Detail cards: khách, pet, dịch vụ, chi nhánh, thời điểm hẹn, trạng thái, payment riêng, statusHistory nếu BE cung cấp. Không tự tạo timeline hoặc payment.
- Dialog dạng bản nháp: đổi lịch, hủy lịch, cập nhật trạng thái. FE hiển thị rule 24h, đếm số lần đổi (nếu BE có), điều kiện override, nhập lý do, kiểm tra input. **Không gửi thay đổi thật** khi BE chưa xác minh endpoint/permission.
- Không giả định Customer `/my-history` dùng được cho Staff và không lấy pet/payment từ dữ liệu mẫu.

## BE cần bổ sung/xác nhận (đề xuất endpoint, không phải API đã có)
### 1. List
`GET /api/v1/admin/appointments?page=&limit=&search=&status=&createdAtFrom=&createdAtTo=&branchId=`
- Trả `items`, `total`, `nextCursor`/pagination ổn định, lọc ngày tạo và status server-side.
- Các fields tối thiểu: `id`, `code`, `createdAt`, `status`, `customerName`, `serviceNames`, `branchId`.
- Manager/Receptionist chỉ thấy lịch trong branch được phân quyền.
- Không cần gửi full thông tin bệnh án lên trang danh sách.

### 2. Detail
`GET /api/v1/admin/appointments/:id`
- Return: `id,code,createdAt,appointmentAt,status,customer,pets,segments,branch,payment`.
- `rescheduleCount` rõ ràng; `allowedActions` được BE tính theo role, branch, state, thời hạn, số lần đổi, locks.
- `statusHistory` và `auditHistory`: event at, actor, note, from/to, override reason; `cancelledAt` và `cancellationReason` nếu có.
- `payment` và `refund` có trạng thái riêng; không đánh đồng CANCELLED=REFUNDED.

### 3. Reschedule
`POST /api/v1/admin/appointments/:id/reschedule`
- Input: idempotency key, expectedVersion, date/time/slot (hoặc authoritative quote), reason, optional overrideReason.
- Validate toàn bộ BOOKABLE segment, staff roles, Nurse→Veterinarian review, shifts, capacity, conflicts và thời lượng; đảm bảo tài nguyên lịch cũ được giải phóng/đặt lại nguyên tử.
- Giới hạn tối đa 2 lần đổi, chỉ tính **đổi thành công**. Không tiêu quota đổi khi API lỗi, timeout, hoặc validation failure.
- Chuẩn 24 giờ tính theo thời điểm bắt đầu lịch hẹn (timezone Asia/Ho_Chi_Minh) trên BE clock; chốt inclusive/exclusive cutoff.
- Override của Manager/Admin phải có audit và lý do bắt buộc, không cho Receptionist tự override.

### 4. Cancel
`POST /api/v1/admin/appointments/:id/cancel` **hoặc PATCH** — chốt phương thức với BE.
- Validate rule 24 giờ, trạng thái, actor scope và override. Lý do bắt buộc.
- Không hard delete. Trả trạng thái CANCELLED, cancellation history, `refundEligibility`, `refundStatus`, `paymentStatus`.
- Mock refund nếu đủ điều kiện; lỗi hoàn tiền không được tạo "đã hoàn tiền" giả; xử lý hoàn voucher quota/capacity đúng nghiệp vụ.
- Atomic/idempotent khi cancel song song với complete/no-show/reschedule. Nếu version conflict, lỗi 409 và tải lại.

### 5. Status transitions
`POST /api/v1/admin/appointments/:id/status` (đề xuất cho các chuyển trạng thái vận hành còn lại)
- Trả allowedActions/server state machine theo vai trò (Admin/Manager/Receptionist).
- Receptionist **không** được chuyển `IN_PROGRESS → COMPLETED` thủ công.
- Khi bắt đầu phục vụ, BE phải đồng thời tạo/liên kết ServiceRecord cho phần dịch vụ tương ứng; thao tác này cần atomic/idempotent.
- `COMPLETED` là trạng thái hệ thống tự cập nhật sau khi tất cả service segment hoàn thành và ServiceRecord liên quan được finalize đúng rule.
- `NO_SHOW` phải đi qua xác nhận có thẩm quyền; audit actor/time/old/new status, reason, consistent across apps.

### 6. Error / idempotency
- Các code ví dụ `OUTSIDE_CANCEL_WINDOW`, `MAX_RESCHEDULE_REACHED`, `SLOT_UNAVAILABLE`, `STAFF_CONFLICT`, `APPOINTMENT_STATE_CONFLICT`, `PERMISSION_DENIED`, `REFUND_PENDING`.
- BE trả 400/403/404/409/422 cùng message cho FE (không tiết lộ thông tin người dùng khác).
- Tránh trùng đổi lịch, duplicate refund, stale quote bằng Idempotency-Key + optimistic concurrency.

## Figma cần hoàn thiện/duyệt
- **D01** Chi tiết lịch hẹn: Breadcrumb, thông tin khách/pet, segments, nhân viên, chi nhánh, trạng thái thanh toán, timeline.
- **D02** Đổi lịch: slot picker theo BE availability, số lần còn lại, deadline, lý do, cảnh báo tác động payment; ghi rõ modal override.
- **D03** Hủy lịch: chính sách 24h, refund mock dự kiến, lý do, xác nhận 2 bước; không gọi nút "Xóa" theo nghĩa xóa hẳn.
- **D04** Cập nhật trạng thái: hiển thị các action do BE trả về, lịch sử audit, trạng thái cuối và thông báo lỗi.
- **D05** Loading/empty/403/404/conflict/expired slot, xác nhận thành công từ BE, pending refund khác completed refund.

## Điều kiện nghiệm thu
1. Không có lịch ngoài branch/role.
2. 24h chính xác (23:59 chặn; 24:00 theo cutoff BE được chốt).
3. Đổi thành công lần 1–2, lần 3 chặn trừ override hợp lệ, mọi override có audit.
4. Hủy/xử lý payment/refund không giả "đã hoàn".
5. Không bị double-book/double-cancel khi 2 người cùng thao tác.
6. Trạng thái terminal không có hành động sai.
7. Trang chi tiết chỉ hiện dữ liệu thật; Figma detail được duyệt trước pixel-perfect/UAT.


## Update 2026-11-01 — remove PENDING_CONFIRMATION
- Product/leader decision supersedes the previous manual confirmation step.
- Ordinary BOOKABLE lifecycle becomes: `PENDING_PAYMENT → CONFIRMED → IN_PROGRESS → COMPLETED`; payment-free valid bookings may enter `CONFIRMED` directly.
- Receptionist/Manager/Admin no longer performs a separate “Confirm appointment” action.
- Existing BE `PENDING_CONFIRMATION` is legacy and must be migrated/removed; FE temporarily normalizes it to `CONFIRMED`.
- REQUEST_ONLY remains a separate request-review process and is not auto-confirmed by this change.
- Before enabling auto-confirm, BE must fix segment-level capacity checking and make payment-success + reservation-confirmation atomic/idempotent.
