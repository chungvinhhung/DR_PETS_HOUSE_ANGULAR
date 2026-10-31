# WEB 2 — Đối chiếu Figma cập nhật 31/10/2026 với Angular FE

**Nguồn:** file FE HANDOVER – CẬP NHẬT LOGIC WEB 2 (31/10/2026); Figma WEB-2 các node 6120:17787, 8386:42133, 8357:41326, 7496:42241, 8302:40129, 8417:42078, 8308:40425, 8308:40588; nhánh FE `feature/admin-appointments-figma`.

**Nguyên tắc:** Figma xác nhận giao diện; BE là nguồn xác thực dữ liệu/quyền. Không dựng sẵn TXK/PNK, mốc timeline, lượng restock/hoàn hay trạng thái pet nếu API không có.

## Phần đã sửa trong đợt này

- Hồ sơ dịch vụ: bảng vật liệu đổi `Template` → `Chỉ định` và bổ sung `Tồn sau dịch vụ`, `Mã giao dịch kho`, `Ghi chú`. Số `0` hiển thị đúng, không biến thành dash. Chỉ map các trường mà API thực sự cung cấp; khi thiếu hiển thị dash.
- Hồ sơ dịch vụ: chuẩn hóa nhật ký mới nhất trước, không tạo sự kiện giả.
- Chi tiết lịch hẹn: sắp xếp lịch sử theo thời gian mới nhất trước; giữ các sự kiện thật từ BE.

## Các chênh lệch chưa hoàn tất — không đánh dấu MATCH 100%

| Nhóm | Hiện trạng FE quan sát | Figma mới / yêu cầu | Hành động cần tiếp |
|---|---|---|---|
| Kho – Lịch sử | Bảng hiện có 8 cột; mã đang cắt từ `tx.id`; mỗi dòng từ một DTO giao dịch | Mã GD/Tham chiếu, thời gian, SKU, tuyến, lý do, delta, tồn sau, actor; có thể một GD nhiều dòng SKU | BE cung cấp `transactionGroupId/code`, `lines[]` hoặc nhóm cùng transaction, tổng số *dòng* và tổng số *giao dịch* riêng; sửa mapper theo hợp đồng |
| Kho – Drawer | Chưa có drawer tra cứu tại chỗ | Bốn section, mở từ mã GD; đầy đủ SKU và tham chiếu nguồn | BE endpoint chi tiết giao dịch nhóm hoặc DTO list đủ dòng; cần kiểm tra role/scope |
| Kho → Nguồn | Chưa hỗ trợ các route drilldown trong drawer | ORD/RT/SR mở đúng màn nghiệp vụ | Chốt mã → ID route thật từ BE, không đoán ID từ prefix mã |
| Order detail | Chi tiết render trong `admin-order-management.component.html`; chưa có section kho | Card giao dịch kho dưới dòng hàng; payment/timeline song song, action modal | BE trả các ISSUE gắn Order và policy thời điểm ISSUE; không suy trạng thái kho theo Order status |
| Return detail | Hiện nhận hàng có `receivedQty` và `restockQty`; warehouse panel vẫn có nút disabled | Bốn chỉ số tồn kho, mã PNK mở drawer, approvedQty độc lập, timeline | Cần dữ liệu reference TXK/PNK theo return + allowedActions; chuyển nút disabled thành mã có thể mở sau khi xác minh API |
| Appointment detail | FE hiện có card tổng hợp petNames/serviceNames, chưa có dòng theo pet/service | Bảng 9 cột pet/service, check-in riêng từng pet, menu riêng, modal bắt đầu/hoàn tất | BE cần DTO per-segment: stable segmentId, petId, serviceId, checkInStatus/At/Actor, serviceStatus, allowedActions; mutations per-segment với role guard |
| Appointment partial changes | Hiện modal reschedule/cancel/status chỉ **kiểm tra**, chưa thực thi | Khi một pet đang làm, pet khác được check-in/hủy/đổi riêng | Không tự sửa APT tổng hay hủy cả lịch; cần endpoint item-level + refund/deposit recalculation |
| Completion | Chưa có modal checkbox record statuses | Chỉ hồ sơ COMPLETED được chọn; chưa hoàn thành disabled xám đúng style | BE xác nhận all-appointment completion khi vẫn có service chưa hoàn tất, không đánh dấu toàn lịch sớm |
| Service Record materials | Trước đó 4 cột, đã đổi thành 6 | Chỉ định, thực tế, tồn sau, mã TXK, ghi chú | BE cần trả stockAfter và transaction ID/code thật, có thể nhiều mã điều chỉnh; mã TXK trở thành drawer link khi endpoint thực sẵn |
| Service Record material add/finalize | FE đang read-only + cảnh báo finalize chưa khả dụng | Modal thêm vật tư phát sinh, finalize tạo ISSUE theo từng SR | Chốt Material lookup theo branch, quyền finalize, một ISSUE nhóm theo SR và transaction delta khi sửa sau finalize |

## BE/BA cần chốt (P0 trước khi code action thật)

1. Order `ISSUE` phát sinh tại thời điểm tạo đơn hay sau trạng thái xử lý? FE không dự đoán từ status.
2. Inventory transaction: một TXK nhiều dòng/SKU hay mỗi row DTO là transaction? Contract nhóm và mã hiển thị là gì?
3. Service Record finalized ISSUE: một SR một transaction chính; Figma hiện tái sử dụng mã TXK của hai SR — cần sửa dữ liệu mẫu hoặc xác nhận grouping.
4. Appointment có thể hỗn hợp MEDICAL/GROOMING trong cùng lịch không? Cấu trúc/ID từng segment?
5. Điều kiện hoàn tất Appointment khi một pet COMPLETED, pet khác IN_PROGRESS?
6. Check-in/Start/Cancel/Reschedule một pet: permission + API + phương án hoàn tiền/cọc/hẹn tách riêng.
7. Mapping Warehouse sourceId → Order/Return/SR ID chính xác. Chỉ dùng link khi ID hợp lệ từ API.

## Kiểm thử nghiệm thu cần thực hiện

- TXK 2 SKU: 2 dòng cùng mã GD, drawer chứa 2 item; phân biệt 9 dòng thuộc 8 giao dịch.
- Return có `requestedQty !== receivedQty !== approvedQty !== restockedQty`, không cộng kho sai.
- Multi-pet: Max ARRIVED + Luna NOT_ARRIVED; check-in Luna không thay Max; chỉ START các dòng ARRIVED và NOT_STARTED.
- Figma disabled checkbox: record IN_PROGRESS/PENDING_VET_REVIEW disabled bằng màu nền và viền xám, COMPLETED vẫn chọn được.
- Service material: Template 2, Actual 0 phải hiển thị 0; chưa có TXK phải hiển thị dash; finalize thành công mới hiện mã thật.
- Timeline: BE events mới nhất trước, không hardcode thời gian.
- Build Angular + E2E role ADMIN/MANAGER/STAFF với DB staging, không chỉ dựa build PASS.

**Không merge vào main/develop khi các flow mới chưa được xác minh E2E.**
