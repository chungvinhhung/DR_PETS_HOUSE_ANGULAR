# WEB 2 — BE handoff: phân ca nhiều ngày, kiểm tra xung đột giữa chi nhánh

**Trạng thái FE:** Đã thêm Shift + Click chọn nhiều ngày trên cùng hàng nhân viên và modal ma trận Ngày × Ca tại \`/admin/staff/schedule\`.
**Lưu ý:** BE hiện chỉ hỗ trợ \`GET/POST /shifts\`, \`PATCH /shifts/:id\` và \`POST /shifts/:id/cancel\`. Chưa có mẫu ca chi nhánh theo ngày, API thay thế atomic hoặc API tra cứu xung đột tổ chức với quyền MANAGER.

## 1. UI/logic đã triển khai trên FE

- Click ô lịch bình thường: giữ modal phân công một ngày cũ.
- Shift + Click ô lịch: chọn nhiều ngày của **một nhân viên**. Các nhân viên khác mờ và không thể chọn; thanh Phân ca (n) xuất hiện; Esc/Hủy chọn để thoát.
- Modal ma trận **hàng là ca; cột là các ngày đã chọn**. Chọn nhiều ca/ngày, cả hàng, bỏ chọn; ô không áp dụng có dấu gạch ngang.
- Kiểm tra ngay khi chọn ca với những ca hiện có nhìn thấy từ \`GET /shifts?staffId=&dateFrom=&dateTo=\` và những ca đang chọn. So sánh khoảng \`[startAt,endAt)\` tuyệt đối (Asia/Ho_Chi_Minh, có qua nửa đêm).
- Nếu trùng: hộp thoại cho biết lịch mới và ca bị ảnh hưởng; "Thay thế bằng lịch này" chỉ lên phương án, "Hủy bỏ" bỏ lựa chọn mới. Không có bước xem trước hoặc nút kiểm tra riêng.
- FE có thể POST từng ca mới **không thay thế**, nhưng nếu một request giữa chừng thất bại có nguy cơ lưu một phần; FE báo chính xác số ca đã lưu và tải lại dữ liệu.
- Với **bất kỳ lịch nào cần thay thế**, FE gọi \`POST /shifts/bulk-assign\`. Khi BE chưa hỗ trợ, lưu sẽ lỗi có thông báo và **không xóa ca cũ**. FE tuyệt đối không gọi "cancel" rồi mới "create" bằng hai request riêng.

## 2. P0 — API mẫu ca tại chi nhánh và ngày áp dụng

Đề nghị BE tạo dữ liệu **mẫu ca làm việc** theo chi nhánh, tách khỏi Shift được phân cho nhân viên.

**Gợi ý** \`GET /branches/:branchId/shift-templates?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD\`.

Mỗi mẫu gồm: \`id\`, \`branchId\`, \`name\`, \`startTime\` (HH:mm), \`endTime\` (HH:mm), \`weekdays\` (ISO 1..7), \`status\` và, nếu có, exception overrides theo từng ngày. Chỉ các ca đang hoạt động, áp dụng trong ngày được chọn mới bật checkbox trong ma trận.

Hiện tab "Ca làm việc tại chi nhánh" trong FE Branch Management mới là **local preview**, chưa lưu vào BE; không thể dùng dữ liệu demo đó để tạo ca thật. FE tạm có nút "Thêm ca" nhập tên/giờ/ngày áp dụng cho lần phân công.

## 3. P0 — Cross-branch conflict visibility

Hiện \`GET /shifts\` của MANAGER chỉ trả ca thuộc \`assignedBranchIds\`. Vì vậy manager có thể phân ca ở chi nhánh Quận 2 nhưng **không thấy** ca trùng ở Quận 1, nếu không được gán Quận 1. Guard 409 tại POST chỉ phát hiện lúc bấm Lưu — chưa đáp ứng đủ "tự kiểm tra ngay khi tích ô".

Đề nghị endpoint tra cứu xung đột theo nhân viên + khoảng thời gian, ví dụ:
\`POST /shifts/check-conflicts\` với \`{staffId, candidates:[{branchId,startAt,endAt}]}\`.

Trả về cho từng candidate các ca trùng (id, branchName, startAt/endAt, cancellationAllowed), có kiểm soát phân quyền phù hợp; **không lộ dữ liệu nhân sự ngoài phạm vi được phép**. Đừng dựa duy nhất vào kết quả FE: vẫn kiểm tra lại trong transaction khi lưu.

Yêu cầu chính xác: so sánh \`existing.startAt < candidate.endAt && existing.endAt > candidate.startAt\` để 13:00 nối tiếp 13:00 **không trùng**; ca qua nửa đêm, ca chồng giữa các chi nhánh, nhiều ca cùng ngày đều được kiểm tra.

## 4. P0 — Atomic bulk assignment / replacement

**Endpoint FE đã chuẩn bị** \`POST /shifts/bulk-assign\` (Bearer + Idempotency-Key). Payload ví dụ:

\`\`\`json
{
  "staffId": "staff-id",
  "branchId": "branch-2-id",
  "create": [
    {"startAt": "2026-11-02T05:00:00.000Z", "endAt": "2026-11-02T12:00:00.000Z"}
  ],
  "cancelShiftIds": ["existing-shift-id"]
}
\`\`\`

Yêu cầu:
1. Kiểm tra quyền tạo ở branch mới **và** quyền hủy từng ca cũ; nếu không đủ quyền phải reject cả giao dịch (403).
2. Kiểm tra staff authorized tại branch đích, trạng thái hoạt động của staff/branch, lịch đặt khám đã CONFIRMED/IN_PROGRESS trước khi hủy.
3. Tính xung đột trên trạng thái **sau khi áp dụng toàn bộ** các thay đổi (các ca cancel không còn, ca create không trùng nhau hay trùng ca còn lại).
4. Thực hiện \`cancelShiftIds\` và \`create\` **trong một MongoDB transaction** có kiểm soát đồng thời/optimistic concurrency; không phát sinh trạng thái lưu một phần.
5. Dùng Idempotency-Key (retry cùng key không tạo trùng).
6. Trả \`201/200\` và chi tiết \`created\`, \`cancelled\`; nếu lỗi 409 trả \`code\` cụ thể (SHIFT_OVERLAP/SHIFT_VERSION_CONFLICT/CONFIRMED_APPOINTMENT) + thông tin ca bị ảnh hưởng được phép xem.
7. Quy định idempotent nếu một ca trong cancelShiftIds đã CANCELLED; và không cho xóa ca nằm ngoài phạm vi quyền.
8. Nếu request có nhiều ca tạo mới mà **không** cancel, cũng nên hỗ trợ cùng API để đảm bảo all-or-nothing, thay thế vòng lặp POST từng ca của FE.

**Test tối thiểu:** Q1 07–13, Q2 12–19 → trùng; Replace thì Q1 CANCELLED + Q2 ACTIVE atomically; Cancel thì Q1 giữ nguyên/Q2 không tạo; lỗi quyền ở Q1 rollback; lỗi lịch hẹn đã xác nhận rollback; hai request đồng thời không tạo lịch trùng; ca 07–13 và 13–19 không trùng; ca qua nửa đêm và ở ngày kế tiếp; tạo 2 ca trùng nhau cùng ngày bị reject.

## 5. Phân kỳ

- **FE hiện có thể chạy:** selection, ma trận, check local theo ca BE mà người dùng có quyền đọc, quản lý nhiều ca/ngày, cảnh báo, thêm ca không thay thế theo API cá thể.
- **Còn chờ BE:** mẫu ca/weekday thật; phát hiện ca ở chi nhánh ngoài phạm vi MANAGER ngay khi click; thay thế atomic/cancel Shift; all-or-nothing cho tạo hàng loạt.
- Không hiển thị thông báo "Lưu thành công" khi BE từ chối; sau khi BE bổ sung API cần nối phần mẫu ca và kiểm thử E2E cross-branch trước khi merge.
