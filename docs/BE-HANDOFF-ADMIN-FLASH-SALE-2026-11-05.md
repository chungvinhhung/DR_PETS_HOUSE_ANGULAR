# WEB 2 — BE Handoff: Flash Sale Admin / Customer / Checkout

**Ngày:** 05/11/2026  
**FE branch:** `feature/admin-flash-sale-content-management`  
**Trạng thái:** FE đã dựng giao diện + API client; BE foundation-v6 chưa có routes quản trị Flash Sale trong module `src/`. Trong `legacy/` / `build/` có source cũ, **không phải bằng chứng API đang triển khai**.

## CẬP NHẬT ƯU TIÊN 05/11/2026 — AUTO / MANUAL TRƯỚC GIỜ, ACTIVE / PAUSED TRONG GIỜ

Quy tắc thay thế những ghi chú cũ về việc switch chỉ hiện khi chọn ngày hôm nay:

1. **Bất kỳ ngày/giờ bắt đầu hợp lệ trong tương lai**: switch với nhãn bật = `Tự động hoạt động theo lịch` (`activationMode:'AUTO', isPaused:false`), nhãn tắt = `Kích hoạt thủ công` (`activationMode:'MANUAL', isPaused:true`). Điều này áp dụng cả trường hợp startAt là ngày mai hoặc các ngày sau.
2. **Từ startAt đến trước endAt**: cùng switch hiển thị bật = `Đang hoạt động` (`isPaused:false`), tắt = `Tạm ngừng` (`isPaused:true`). Nếu Admin chọn MANUAL trước giờ bắt đầu, tại thời điểm startAt chương trình **phải giữ PAUSED**, không được tự chuyển RUNNING.
3. **Sau endAt**: không cho bật lại hoặc mua theo giá Flash Sale. BE phải kiểm soát bằng đồng hồ server, không phụ thuộc đồng hồ FE.
4. `FlashSaleWriteBody` phải lưu thật `activationMode:'AUTO'|'MANUAL'` cùng `isPaused`. `POST /flash-sales/:id/publish` nhận `{activationMode,isPaused}` và thực hiện transaction nguyên tử. `PATCH /flash-sales/:id/pause` nhận `{activationMode,isPaused}` và cập nhật nguyên tử; đừng chỉ lưu `activationMode` rồi chờ cron.
5. `GET /flash-sales`, `GET /flash-sales/:id` cần trả lại `activationMode` và `isPaused` đã persist. Nếu BE không hỗ trợ toàn bộ contract, FE không được coi là E2E PASS.
6. **Voucher** dùng hai giai đoạn UI y hệt, nhưng dựa vào BE đã có `status:'ACTIVE'|'INACTIVE'`: trước giờ, ACTIVE = AUTO, INACTIVE = MANUAL; trong giờ ACTIVE = Đang hoạt động, INACTIVE = Tạm ngừng. Voucher INACTIVE trước giờ **phải tiếp tục INACTIVE sau khi đến giờ**; không được tự bật lại. Eligibility checkout phải kiểm tra đồng thời status, effectiveFrom/effectiveTo, quota và các điều kiện giao dịch.

**Bổ sung UAT:** kiểm thử lúc 1 phút trước giờ bắt đầu → đúng giờ → 1 phút sau, đối với cả AUTO và MANUAL; kiểm tra reload, chuyển tab, tài khoản khác, scheduler, và mua hàng lúc chương trình MANUAL đang tạm ngừng. Mỗi trạng thái phải được duy trì thật trong DB và được Checkout enforce.

## 1. Vị trí UI và các quyết định đã chốt

- Admin → Bán hàng → Khuyến mãi → localtab **Voucher | Flash Sale**.
- Các màn: danh sách, tạo mới, chọn SKU, chỉnh sửa, xem chi tiết.
- **Không cấu hình Flash Sale theo chi nhánh**. Điều kiện mua vẫn cần tồn kho fulfillment theo Order hiện hành.
- Không nhập tay “Sắp diễn ra”, “Đang diễn ra” hoặc “Đã kết thúc”.
- Admin có `DRAFT` (Lưu bản nháp), `PUBLISHED` (Lưu chương trình, bao gồm lên lịch trước khi bắt đầu), và **switch** `isPaused` để tạm ngừng/tiếp tục chương trình đã kích hoạt trong khoảng thời gian chạy.
- FE tạo/sửa bản nháp có 3 nút phân cấp: Hủy bỏ, Lưu bản nháp, Lưu chương trình. “Lưu chương trình” gọi create/update rồi publish; nếu `now < startAt` thì trạng thái hiển thị **Sắp diễn ra** chứ không chạy ngay; nếu `startAt <= now < endAt` thì **Đang diễn ra**.
- Section switch “Trạng thái chương trình” hiển thị ngay trong form tạo/sửa bản nháp khi **ngày bắt đầu là ngày hôm nay** (giờ Việt Nam), hoặc ở chương trình PUBLISHED đang hiệu lực / sắp bắt đầu trong hôm nay. Switch BẬT = sẽ hoạt động đúng lịch (`isPaused: false`); TẮT = tạm ngừng (`isPaused: true`). Hết thời gian kết thúc không được publish hoặc resume. Nếu chuyển ngày bắt đầu sang ngày tương lai thì trạng thái tạm ngừng chưa áp dụng được đặt lại về BẬT.
- Khi tạo/sửa DRAFT, `isPaused` trong request phải được **lưu thật** cùng chương trình. `POST /flash-sales/:id/publish` chấp nhận body `{ "isPaused": boolean }` và BE **phải commit trạng thái publish + isPaused trong cùng một transaction**, không được cho chương trình chạy một khoảng ngắn rồi mới tạm ngừng. Có thể dùng `PATCH /pause` riêng cho thay đổi trạng thái chương trình đã PUBLISHED.
- Display state do BE tính bằng UTC server time: `DRAFT`, `PAUSED`, `UPCOMING`, `RUNNING`, `ENDED`. Precedence: DRAFT → ENDED → PAUSED → UPCOMING → RUNNING. Thời gian form FE được nhập theo Asia/Ho_Chi_Minh và gửi ISO UTC.

## 2. REST contract FE đang gọi (cần BE xác nhận/triển khai)

| Method | Route | Quyền | Mục đích |
|---|---|---|---|
| GET | `/api/v1/flash-sales?limit=10&search=&state=&cursor=` | ADMIN, MANAGER | Danh sách, tìm kiếm, filter theo **display state**; cursor và totalCount |
| GET | `/api/v1/flash-sales/:id` | ADMIN, MANAGER | Chi tiết kèm SKU, giá, quota và đã bán |
| POST | `/api/v1/flash-sales` | ADMIN | Tạo **DRAFT** idempotent; yêu cầu header `Idempotency-Key` |
| PATCH | `/api/v1/flash-sales/:id` | ADMIN | Cập nhật form, kiểm tra version khi cần |
| POST | `/api/v1/flash-sales/:id/publish` | ADMIN | DRAFT → PUBLISHED và áp dụng `isPaused` nguyên tử; idempotent |
| PATCH | `/api/v1/flash-sales/:id/pause` | ADMIN | Body `{ "isPaused": true/false }` |
| GET | `/api/v1/flash-sales/active?limit=12` | CUSTOMER/Public | Chương trình thực sự đang chạy và các SKU eligible, cùng `endAt` do BE trả |

Nếu BE chọn đường dẫn khác, bắt buộc cập nhật API contract/OpenAPI và phản hồi FE trước khi chạy UAT; không đổi UI có tính năng nhưng không API.

### 2.1. Response cho danh sách

```json
{
  "items": [
    {
      "id": "FLASH_ID",
      "name": "Flash Sale cuối tuần",
      "description": "",
      "startAt": "2026-11-06T00:00:00.000Z",
      "endAt": "2026-11-08T16:59:00.000Z",
      "status": "PUBLISHED",
      "isPaused": false,
      "items": [
        {
          "productId": "PRODUCT_ID",
          "variantId": "VARIANT_ID",
          "sku": "SKU-001",
          "productName": "Tên sản phẩm",
          "variantName": "500g",
          "originalPrice": 290000,
          "salePrice": 199000,
          "quantityLimit": 50,
          "soldQuantity": 4,
          "imageUrl": "https://example.com/product.png"
        }
      ]
    }
  ],
  "nextCursor": null,
  "totalCount": 1
}
```

Mẫu chỉ minh họa **schema**, không phải dữ liệu seed hoặc API đã trả thành công. BE không trả mảng rỗng để che lỗi.

### 2.2. Request tạo/sửa

```json
{
  "name": "Flash Sale cuối tuần",
  "description": "",
  "startAt": "2026-11-06T00:00:00.000Z",
  "endAt": "2026-11-08T16:59:00.000Z",
  "items": [
    {"productId": "PRODUCT_ID", "variantId": "VARIANT_ID", "salePrice": 199000, "quantityLimit": 50}
  ],
  "isPaused": false
}
```

BE lấy tên/SKU/giá retail thật từ Product/Variant, **không tin client gửi originalPrice**. Hình ảnh/giá hiển thị khi reload lấy từ quan hệ thật.

## 3. Các quy tắc không được bỏ qua

1. Chỉ Product/Variant ACTIVE, thuộc loại dùng để bán, và có giá retail hợp lệ mới được áp dụng. SKU unique trong một chương trình.
2. `salePrice` là số VND nguyên, `0 < salePrice < giá bán được BE xác nhận`. `quantityLimit` nguyên dương và `soldQuantity <= quantityLimit`; không giảm quota thấp hơn đã bán.
3. Không cho xung đột 2 chương trình **cùng hiệu lực** đối với cùng SKU nếu không có rule ưu tiên minh bạch, được BA chốt và code BE đồng nhất Customer/Checkout.
4. Phân biệt rõ `DRAFT` và `PUBLISHED`. Các chương trình DRAFT không hiện trên web. Khi `PUBLISHED`, thời gian tự xác định UPCOMING/RUNNING/ENDED; tạm ngừng bằng `isPaused` không phải đổi timestamp.
5. Paused / expired / sold out không được áp dụng sale price trên product detail, cart hoặc checkout. Khi hết thời gian, web bỏ giá sale ngay theo thời gian BE (tránh đồng hồ FE sai).
6. **Checkout phải revalidate giá, thời gian, stock và quota bằng transaction ở BE**, không tin giá FE. Hai người mua cùng lúc không bán vượt quota/tồn, reservation/cancel/timeout phải giải phóng quota chính xác một lần.
7. Giá sau Flash Sale không tự cộng thêm Voucher hoặc khuyến mãi variant khác cho cùng SKU khi chưa có rule stacking được BA chốt.
8. Flash Sale SKU có thể hiển thị nhiều branch phục vụ fulfillment, nhưng **không thêm field chọn branch trong Admin Flash Sale**.
9. Role ADMIN write, MANAGER read, STAFF không được sửa. 400/401/403/404/409/422/429/500 trả code và correlationId chuẩn.
10. Tất cả thao tác persist và có audit actor/time, version; API không được fake success khi chưa có DB transaction.
11. FE không cho chọn `startAt` cũ hơn thời điểm hiện tại theo giờ Việt Nam ở màn tạo/bản nháp (datetime-local min cập nhật mỗi phút); BE bắt buộc kiểm tra lại theo server clock. Bản PUBLISHED đã bắt đầu khóa thay đổi `startAt`, nhưng vẫn cho xem và cập nhật các trường hợp lệ được phép.
12. Giá Flash Sale chọn theo SKU, nhập VND nguyên dương và cho tăng/giảm **bước 1.000đ** giống giá bán ở form sản phẩm; BE kiểm tra điều kiện thấp hơn giá retail và không tin giá từ client.

## 4. Data + UAT: bắt buộc trước khi BE đóng task

- Seed trên đúng DB deploy: 1 DRAFT, 1 UPCOMING, 1 RUNNING, 1 PAUSED, 1 ENDED; mỗi loại có SKU thật, giá thật, ảnh thật, tồn bán và hạn mức; tối thiểu 1 chương trình có 2 SKU/2 biến thể.
- Test GET list/search/status filter, cursor next/prev và exact `totalCount` phù hợp.
- Test POST draft, edit, publish, pause, resume, reload và role ADMIN/MANAGER/STAFF.
- Test 2 SKU cùng chương trình; SKU inactive, giá không hợp lệ, trùng SKU, quota quá thấp, end trước start.
- Test overbooking/hết quota bằng 2 checkout đồng thời; cancel/refund/expire trả lại quota theo nghiệp vụ.
- Test chương trình hết giờ khi trang Customer đang mở (countdown/server clock), và program Paused không trả active deal.
- Test Customer flash sale section **không hiển thị dữ liệu demo fallback** sau khi API hoạt động; đúng số sản phẩm/giá sale từ BE.
- Cung cấp commit SHA đang deploy, base URL, DB alias, seed counts, OpenAPI, request/response redacted, API E2E logs, kết quả FE UAT.

## 5. Những phần FE chưa thể đánh dấu đã hoàn tất

FE hiện có screens + contract client, có kiểm tra input, loading/empty/error, quyền Admin/Manager và không lưu giả. **Chưa thể xác nhận** tạo/lưu/kích hoạt/tạm ngừng thực sự hay tác động checkout/Customer khi BE chưa mount API trên môi trường sử dụng.

Do vậy, Flash Sale FE feature là **READY FOR BE INTEGRATION**, chưa phải E2E PASS. Nhánh `main` và PR #33 vẫn không thay đổi.
