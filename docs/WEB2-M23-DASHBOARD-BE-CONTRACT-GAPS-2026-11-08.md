# WEB 2 — M23 Admin Dashboard: BE Contract Gaps

**Ngày đối chiếu:** 08/11/2026  
**FE branch:** `feature/admin-flash-sale-content-management`  
**BE source đối chiếu:** `minhllk24/PET_CLINIC_BACKEND`, branch `feat/foundation-v6`  
**Trạng thái:** FE layout + filter + KPI Order/status từ BE thật; **chưa nghiệm thu nghiệp vụ M23 P1**.

## A. Những endpoint đã thấy trong BE

| Route hiện có | Đánh giá với đặc tả FE M23 |
|---|---|
| `GET /dashboard/summary` | Order count và breakdown theo Order.createdAt/fulfillmentBranchId có thể dùng. Các chỉ số còn lại chưa đúng định nghĩa M23. |
| `GET /dashboard/revenue-analytics` | Chỉ tổng hợp doanh thu Order theo ngày tạo, chưa tách Order / Service / Refund. |
| `GET /dashboard/low-stock` | Dùng threshold cố định mặc định 5, thiếu ngưỡng cấu hình theo branch. |
| `GET /dashboard/service-stats` | Đếm Appointment không hủy, ước tính doanh thu từ giá Service, chưa đếm Service Segment hoàn thành. |

**Không tự lấy danh sách phân trang của Order/Appointment để tính KPI trên FE.** Phần nào thiếu aggregate chuẩn thì FE hiển thị trạng thái chờ BE, không dùng số mock.

## B. Các gap BE bắt buộc cần sửa để đạt M23 P1

### DASH-BE-01 (P0) — Revenue đúng mốc hoàn thành
- Order ghi nhận tại thời điểm `DELIVERED`, không theo `createdAt` của đơn; loại shipping; trừ refund hoàn tất theo thời điểm hoàn tiền, không trừ 2 lần.
- Appointment ghi nhận khi `COMPLETED` theo final amount sau Voucher, không cộng riêng tiền cọc/balance và không đếm lịch hủy/no-show.
- Summary và trend phải đối chiếu được số liệu với nhau; trend gồm `orderRevenue`, `serviceRevenue`, `refundAdjustment`, `totalRevenue`, period, timezone.
- **Hiện trạng:** service hiện cộng Payment PAID của Appointment, bao gồm khả năng cộng cọc; trend chỉ lấy Order.

### DASH-BE-02 (P0) — Appointment count và breakdown
- Dùng `Appointment.createdAt` để đếm số lịch tạo trong kỳ theo `branchId`; một lịch có nhiều segments vẫn đếm một.
- Trả counts theo từng status hiện tại, đầy đủ trạng thái kể cả `CANCELLED`, `NO_SHOW`, `PENDING_PAYMENT`.
- Tổng status phải đúng bằng KPI Appointment.
- **Hiện trạng:** `/dashboard/summary` dùng `scheduledStart`, không phải ngày tạo.

### DASH-BE-03 (P0) — Khách có giao dịch
- `COUNT(DISTINCT customerId)` trên union Order và Appointment **được tạo trong kỳ**, lọc branch tương ứng, tránh đếm một Customer nhiều lần.
- P1 chỉ đếm Customer đã liên kết ID; Guest chưa liên kết không cộng vào KPI khách nhưng vẫn tính Order/Appointment.
- **Hiện trạng:** `newCustomers` đang đếm `Customer.createdAt` toàn hệ thống và không đúng nhãn KPI.

### DASH-BE-04 (P0) — Top 5 dịch vụ
- Chỉ đếm Service Segment **đã hoàn thành**, không đếm lượt đặt, bị hủy hoặc `REQUEST_ONLY` chưa thực hiện.
- Sắp theo số lượt hoàn thành giảm dần; trả ID, tên, count. Chỉ trả doanh thu dịch vụ nếu có snapshot giá hợp lệ sau phân bổ Voucher.
- **Hiện trạng:** BE dùng `Appointment.services` của lịch chưa bị hủy và cộng giá niêm yết/ước tính.

### DASH-BE-05 (P0) — Cảnh báo tồn kho
- Từng `(branchId, inventoryItemId/SKU)` cần `currentQty` và `lowStockThreshold` của branch.
- `0` = Hết hàng; `0 < qty <= threshold` = Sắp hết; ưu tiên hết hàng; trả branch name và SKU.
- Không lọc theo thời gian; chỉ theo chi nhánh và RBAC.
- **Hiện trạng:** filter `quantity <= 5` toàn hệ thống, không đưa threshold từng SKU/branch trong response.

### DASH-BE-06 (P0) — Thời gian và phân quyền
- Hỗ trợ `from`/`to` (ngày lịch Việt Nam, inclusive), `branchId`, `timezone: Asia/Ho_Chi_Minh`.
- BE tự quy đổi thành timestamps không chồng lấn và chặn Manager truy cập branch không thuộc assigned scope.
- Admin toàn hệ thống; Manager 1 hoặc nhiều branch được phân công.
- Hiện tại `parseDateRange` dựa trên giờ chạy máy chủ; cần thống nhất timezone và thời điểm nhận doanh thu.

### DASH-BE-07 (P1) — Hợp đồng trạng thái/clickthrough
- Mỗi trạng thái Order / Appointment BE trả code chuẩn, count và (nếu áp dụng) mapping của state machine.
- FE có thể map count theo response, không được tự tạo status mới.
- Điều hướng từ Dashboard sang danh sách đã lọc theo kỳ/branch/status cần thống nhất query params giữa hai module.

## C. P2 không chặn M23 P1

**Cần xử lý ngay:** danh sách Order backlog hiện tại (không lọc ngày tạo) và Appointment sắp diễn ra trong 24 giờ, chỉ đọc và đi đến chi tiết. Nếu chưa có API thì hiển thị link điều hướng thay vì giả số lượng tồn đọng.

## D. FE đang làm và phạm vi chờ

- Có giao diện M23 responsive, cùng Admin Catalog Shell và 4 KPI/card.
- Bộ lọc mặc định 30 ngày, hôm nay, 7 ngày, tùy chỉnh; lọc branch theo role/scope; reload khi đổi filter.
- Chỉ sử dụng Order count và Order breakdown từ `/dashboard/summary` (định nghĩa hiện phù hợp), phân biệt loading/error/empty; không hiển thị dữ liệu cũ sau khi đổi filter.
- Revenue, Appointment, Active Customers, Service Top 5, Low-stock by threshold: **không hiện số liệu sai**, hiển thị chờ contract đúng.
- Mọi chức năng chỉ đọc/điều hướng; không đổi trạng thái giao dịch từ Dashboard.

## E. UAT bắt buộc sau khi BE cập nhật

DASH-01 → DASH-20 theo đặc tả FE M23, đặc biệt:
1. Manager Q10 không thấy branch Q1; Manager nhiều branch chỉ thấy assigned.
2. Appointment tạo trong kỳ nhưng `scheduledStart` ngoài kỳ vẫn được đếm.
3. Order DELIVERED khác kỳ tạo được ghi doanh thu đúng kỳ; Refund hoàn tất không trừ đôi.
4. Cọc 30% và balance 70% không tạo doanh thu dịch vụ hai lần.
5. Customer có 3 Order và 2 Appointment chỉ đếm 1 customer.
6. Inventory cùng SKU tại 2 branch có threshold khác nhau vẫn phân loại chính xác.
7. Đổi ngày/branch liên tục không có response cũ ghi đè.
8. Tổng số order/appointment theo trạng thái khớp KPI; dữ liệu rỗng là 0 (không phải mock).

**Yêu cầu:** BE xác nhận tên endpoint, request/response schema, mã trạng thái, timezone, permission và test E2E cho các gap P0 trước khi FE đánh dấu Dashboard M23 hoàn tất.


## F. Bổ sung theo Figma — KPI tăng/giảm và biểu đồ doanh thu (09/11/2026)

### DASH-BE-08 (P1) — So sánh kỳ trước cho bốn KPI
- FE đã triển khai phần trăm tăng/giảm của **Đơn hàng** bằng hai lần gọi `GET /dashboard/summary` trên hai kỳ liên tiếp có cùng số ngày và cùng phạm vi chi nhánh.
- BE cần bảo đảm `from`/`to` theo ngày lịch `Asia/Ho_Chi_Minh`, áp RBAC nhất quán cho cả hai kỳ.
- Với **Doanh thu**, **Lịch hẹn**, **Khách có giao dịch**: chỉ bật so sánh khi các aggregate hiện tại và kỳ trước đã được BE sửa đúng định nghĩa M23 ở DASH-BE-01/02/03.
- Quy tắc: `changePercent = (current - previous) / previous * 100` nếu `previous > 0`. Nếu kỳ trước bằng 0 và kỳ này dương thì hiển thị mức tăng tuyệt đối, không bịa tỷ lệ %.
- Màu: tăng xanh lá, giảm đỏ, không đổi trung tính. Không hiển thị tăng/giảm nếu một trong hai kỳ lỗi hoặc thiếu dữ liệu.
- Mini sparkline đúng nghĩa phải dựa trên các điểm dữ liệu thực theo thời gian. FE tạm dùng **hai cột so sánh kỳ trước/kỳ này** cho Order thay vì vẽ đường xu hướng giả.

### DASH-BE-09 (P1) — Dữ liệu cho biểu đồ doanh thu và tooltip
- Cần API aggregate trả chuỗi `points[]` theo khoảng lọc và branch: `periodStart`, `orderRevenue`, `serviceRevenue`, `refundAdjustment`, `totalRevenue`; thời gian và đơn vị VND rõ ràng.
- Trả tổng kỳ `totalRevenue`, tổng kỳ trước `previousRevenue` và/hoặc tỷ lệ `changePercent` có định nghĩa thống nhất.
- Hover tooltip phải hiển thị mốc thời gian, doanh thu Order, dịch vụ, điều chỉnh hoàn tiền và tổng thực tế; legend bật/tắt series.
- Đảm bảo tổng các điểm (sau refund adjustment) khớp KPI doanh thu. Chỉ hiển thị chart/tổng/% khi API đúng DASH-BE-01, không dùng endpoint legacy `/dashboard/revenue-analytics` hiện đang ghi nhận theo Order.createdAt.
- Gợi ý response (contract cần BE xác nhận): `{ totalRevenue, previousRevenue, currency: 'VND', points: [{ periodStart, orderRevenue, serviceRevenue, refundAdjustment, totalRevenue }] }`.
- Cần thêm chuỗi dữ liệu theo thời gian cho từng KPI nếu muốn sparklines 4 ô đúng Figma; không sử dụng số liệu minh họa làm dữ liệu thật.

**FE hiện tại:** Có phần UI so sánh thực cho KPI Order và vùng tổng doanh thu chờ dữ liệu. Chưa hiển thị % cho 3 KPI khác hoặc vẽ biểu đồ doanh thu vì BE chưa cung cấp dữ liệu đáp ứng nghiệp vụ.
