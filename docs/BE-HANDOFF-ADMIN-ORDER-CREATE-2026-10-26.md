# WEB 2 — BE handoff: Admin tạo đơn hộ khách (Figma 6634:30208)

**Ngày đối chiếu:** 26/10/2026
**FE:** `feature/admin-order-management-phase1`, đường dẫn `/admin/orders/new`
**BE source đối chiếu:** `minhllk24/PET_CLINIC_BACKEND:feat/foundation-v6`
**Figma:** https://www.figma.com/design/vak640d4oft2Azmhu7HoGM/WEB-2?node-id=6037-20216

## 0. Quy tắc nghiệp vụ đã được xác nhận

**Khách chưa có tài khoản:** dùng cơ chế **`GuestContact → PENDING_ACTIVATION → ACTIVATED`**, KHÔNG tự đặt mật khẩu/không tự tạo User đăng nhập ngay khi Admin tạo đơn.

**Khách đã có tài khoản:** tra cứu theo số điện thoại, chọn đúng hồ sơ, fill họ tên, điện thoại, email và **địa chỉ mặc định** của khách (chỉ khi API trả dữ liệu tin cậy).

- SĐT ô Tra cứu và ô SĐT Thông tin khách hàng là cùng một dữ liệu; không cho người dùng nhập hai lần.
- Tra cứu tìm thấy nhiều hồ sơ thì phải cho chọn. Đổi khách phải xóa dữ liệu/địa chỉ cũ tránh gán nhầm.
- Tìm sản phẩm theo tên hoặc SKU, hiển thị các variant đang bán, đơn giá `finalPrice`, số lượng, thành tiền, thao tác xóa.
- Product discount tính trước; voucher tính sau trên merchandise subtotal; stock/branch fulfillment là quyền quyết định của BE, không tách đơn. Thanh toán `COD` hoặc `ONLINE_MOCK`; không đánh dấu Online đã trả khi chưa có kết quả.
- Cho nhập ghi chú và địa chỉ giao hàng theo customer flow, không tạo dữ liệu địa chỉ giả.

## 1. Kết luận hiện trạng nguồn API

| Nghiệp vụ | Đã có | Thiếu / vấn đề | Ưu tiên |
|---|---|---|---|
| Tra cứu khách | `GET /customers?search=&limit=` chỉ cho ADMIN/MANAGER | Chỉ partial regex, OR theo email, giới hạn 100, không có exact phone + uniqueness guarantee. Manager branch filter có nguy cơ sai `$or`. | P0 |
| Chi tiết khách | `GET /customers/:id` trả id, phone, fullName, email, activation | KHÔNG có `addresses[]`, `defaultAddressId`, địa chỉ chi tiết trong DTO/schema mới | P1 |
| Tìm hàng | `GET /products?q=&status=ACTIVE` có tìm `variants.sku` | Cần dữ liệu stock theo cả giỏ + active fulfillment branch tại thời điểm quote; listing stock không phải cam kết kho | P1 |
| Giỏ hàng Customer | `GET/POST/PATCH/DELETE /cart` | Cart gắn `req.actor.id` hoặc guest-cart-token; không có chức năng “Admin tạo giỏ hộ Customer”; tuyệt đối không dùng Admin JWT checkout như Customer | P0 |
| Tạo Order | `POST /checkout` có snapshot prices/voucher, chọn branch no split | KHÔNG có `POST /admin/orders` hoặc API create-on-behalf-of-customer; không có response activation workflow | P0 |
| Quote/Voucher | `POST /vouchers/validate` tính từ Cart thật; `POST /checkout` định giá authoritative | KHÔNG có stateless admin quote cho items/customers/guest/voucher/shipping; FE không thể biết shipping fee, voucher chính xác khi chưa có Cart khách | P0 |
| Guest invite | `POST /activation/invite`, `POST /activation/complete`, GuestContact model và service | Invite chưa tự gắn vào thao tác Admin create, token invite được trả trực tiếp và route không yêu cầu auth — nguy cơ chiếm tài khoản | **P0 security** |
| Customer addresses legacy | `legacy/orderAPIService.js` sử dụng `userAddress`/address_id | Code legacy Prisma KHÔNG phải contract của BE Mongo hiện tại; không dùng API/DTO legacy trên FE mới | P1 |

## 2. API BE-ORDER-CREATE-01 — tra cứu chính xác theo SĐT [P0]

**Đề xuất:** `GET /api/v1/admin/customers/lookup?phone=0901234567`, ADMIN auth bắt buộc. Có thể mở rộng endpoint hiện tại nếu bảo đảm cùng contract.

**Response đề xuất (không chứa mật khẩu, tokens):**
```json
{
  "matches": [
    {
      "id": "customerId",
      "fullName": "Nguyễn Văn A",
      "phone": "0901234567",
      "email": "a@example.com",
      "activationStatus": "ACTIVATED",
      "accountStatus": "ACTIVE"
    }
  ],
  "exactPhoneMatch": true
}
```

- Chuẩn hóa phone ở BE, uniqueness/check trùng trên User, Customer, GuestContact theo cùng quy tắc; không chỉ search 100 records rồi FE tự suy ra “không có tài khoản”.
- Nếu khách `BLOCKED`, xác định 403/409 và lý do nghiệp vụ, không được âm thầm tạo GuestContact khác để bypass.
- Manager/Staff chỉ lookup nếu đã chốt quyền và branch; hiện màn Tạo đơn FE chỉ cho ADMIN.
- Sửa filter trong `customer.service.js#listCustomers`: điều kiện branch và search phải AND; không được OR giúp lộ khách ngoài scope. Manager `assignedBranchIds=[]` là phạm vi rỗng.

## 3. API BE-ORDER-CREATE-02 — địa chỉ Customer / mặc định [P1]

**Đề xuất:**
- `GET /api/v1/customers/:id/addresses` trả `{items:[{id,recipientName,phone,line1,ward,district,city,isDefault}],defaultAddressId}`.
- Nếu Figma Sửa/Thêm/Đổi địa chỉ cần lưu vào Customer, yêu cầu thêm POST/PATCH set-default (phải chốt policy). Nếu chỉ thay cho đơn hiện tại, BE create accepts `shippingAddress` snapshot **không cập nhật** địa chỉ đã lưu.
- Bắt buộc xác minh quyền truy cập chi tiết và owner. Default Address duy nhất trong một Customer, không tự gán địa chỉ demo/Figma.
- Với khách vãng lai, cho `shippingAddress` snapshot nhập thủ công, kế thừa customer recipient/phone nếu giống nhau.

## 4. API BE-ORDER-CREATE-03 — báo giá Admin trước xác nhận [P0]

**Đề xuất:** `POST /api/v1/admin/orders/quote` (ADMIN only, side-effect free).

Request:
```json
{
  "customerId": "existingCustomerId-or-null",
  "guestContact": {
    "fullName": "Nguyễn Văn A",
    "phone": "0999888777",
    "email": null
  },
  "items": [
    {"productId":"mongoProductId","variantId":"mongoVariantId","quantity":2}
  ],
  "paymentMethod": "COD",
  "shippingAddress": {
    "recipientName":"Nguyễn Văn A",
    "phone":"0999888777",
    "line1":"123 Lê Lợi, Bến Thành, Quận 1",
    "city":"TP.HCM"
  },
  "voucherCode": "SALE10",
  "note": ""
}
```

Response:
```json
{
  "eligible": true,
  "fulfillmentBranchId": "branchId",
  "items": [
    {
      "productId":"mongoProductId",
      "variantId":"mongoVariantId",
      "sku":"SP-001",
      "quantity":2,
      "unitOriginalPrice":150000,
      "unitPrice":135000,
      "lineSubtotal":270000,
      "allocatedVoucherDiscount":20000,
      "lineNet":250000,
      "availableStock":5
    }
  ],
  "pricing": {
    "merchandiseSubtotal":270000,
    "voucherDiscount":20000,
    "shippingFee":30000,
    "totalAmount":280000
  },
  "voucher": {"code":"SALE10","valid":true,"reason":null},
  "availability": {"canFulfillEntireCart":true,"blockingItems":[]}
}
```

- Response JSON minh họa contract **đề xuất**, không phải dữ liệu thật.
- Tính từ Product/Variant ACTIVE + inventory thực tế + branch priority trong settings, không split; không tin `unitPrice`, `subtotal`, `stock` do FE gửi.
- Quote không reserve stock, không consume voucher quota và không tạo GuestContact/User/Order. Có expiry hoặc revalidation bắt buộc lúc commit.
- Trả lỗi `422 INSUFFICIENT_INVENTORY`, `422 VOUCHER_INVALID` với reason và danh sách sản phẩm thiếu; FE hiển thị tại dòng tương ứng.
- Fee theo cấu hình runtime; không hardcode 30.000đ hoặc ngưỡng 500.000đ trên FE.
- Nếu BE chưa thể build quote, phải chốt cách preview khác có contract rõ ràng; FE không tính voucher dựa trên partial data.

## 5. API BE-ORDER-CREATE-04 — tạo đơn hộ khách [P0]

**Đề xuất:** `POST /api/v1/admin/orders`; `Authorization: Bearer AdminJWT`, `Idempotency-Key: uuid`.

Body tương tự quote, `customerId` và `guestContact` chọn đúng một trong hai; mọi dòng hàng phải có `variantId` và `quantity > 0`. Có thể kèm `quoteId` khi BE cung cấp; nếu không, phải revalidate.

**Transaction bắt buộc:**
1. Kiểm tra quyền ADMIN + xác nhận existing Customer đúng SĐT (không dùng actor Admin làm người mua).
2. Nếu guest, tìm/reuse GuestContact chuẩn hóa phone/email; không tạo duplicate. Chưa có user thì chỉ tạo/reuse GuestContact; **không tạo User/password tại lúc Admin đặt đơn**.
3. Recompute prices, voucher, fulfillment Branch priority, stock cho toàn bộ cart, no split. Update Order/Stock/Payment/VoucherUsage cùng transaction, rollback nếu một bước lỗi.
4. Tạo Order gắn `customerId` thực (user/customer mapping theo schema) hoặc `guestContactId`; snapshot người nhận + địa chỉ, prices và discount per SKU. Có actor/createdByAdmin trong audit.
5. Nếu guest, trigger invite **qua kênh an toàn** và chuyển GuestContact sang `PENDING_ACTIVATION`. Khách nhập mật khẩu/đồng ý điều khoản qua activation workflow; sau `ACTIVATED`, liên kết đơn cũ vào customer. Nếu gửi tin thất bại, ghi trạng thái notification để retry, không giả định đã gửi; tránh gửi mời lặp.
6. `COD` Payment PENDING; `ONLINE_MOCK` không auto PAID khi chưa xác nhận. Quyết định cách kích hoạt mock payment trong Admin order flow, phải có API/response.
7. Response 201 chứa `order.id/code,status,payment,pricing,fulfillmentBranchId,customer/guestActivationStatus,activationInviteStatus`.
8. Retry cùng Idempotency-Key không tạo trùng Order, Payment, GuestContact, stock receipt/quota; concurrent checkout quota=1 chỉ có 1 commit.

**Không** gọi `POST /checkout` với JWT Admin: source `checkoutCreateOrder` tìm Cart theo `customerId=actor.id`; đây không phải tạo hộ Customer.

## 6. P0 security — Activation invite phải bị khóa

**Đã phát hiện trong source:** `guest.routes.js`: `POST /activation/invite` không dùng auth và `guest.service.js#sendActivationInvite` trả `activationToken` thẳng trong response. Khi dùng cùng luồng GuestContact, người biết phone/email có thể gọi invite để nhận token kích hoạt, dẫn đến chiếm quyền tạo tài khoản.

BE cần:
- Chặn truy cập tùy tiện; bắt quyền Admin hoặc workflow OTP đã xác minh, rate limit/captcha theo threat model.
- **Không trả raw activationToken ở API công khai hoặc cho FE Admin.** Gửi qua SMS/email verified channel; lưu token hash + expiry + one-time usage; audit & chống enumeration.
- `activation/complete` tiếp tục do khách thực hiện sau khi xác minh; không tự cấp password cho Admin.
- Test rút token bằng phone người khác -> không nhận được token; replay/expiry/guess -> 401/410; resend có rate limit.

## 7. Cần chốt cùng BA/BE, không tự quyết

- Có hỗ trợ **Nhận tại cửa hàng** trong Admin create hay không? Source Checkout hiện luôn `shippingFee` theo merchandiseSubtotal, chưa có distinct pickup method.
- Sửa/Thêm địa chỉ lúc tạo đơn có cập nhật sổ địa chỉ khách hay chỉ là snapshot một đơn?
- Khi GuestContact đã `PENDING_ACTIVATION`, gửi lại mời trong lần đặt hàng tiếp theo hay giữ nguyên invitation đang còn hiệu lực?
- `ONLINE_MOCK` cho đơn tạo bởi Admin: chuyển khách đến trang mock payment, hay admin được kích hoạt một bước chuyên biệt?
- Manager/Receptionist có được tạo đơn hộ khách hay chỉ ADMIN? FE hiện bảo vệ màn mới cho ADMIN.

## 8. Trạng thái FE và QA

- FE đã nối `GET /customers`, `GET /products` trong `admin-order-create-lookup.service.ts`.
- Form Figma hoàn thiện: SĐT tra cứu liên kết field khách; danh sách kết quả; nhập khách vãng lai; sản phẩm/variant SKU; thêm, sửa số lượng, xóa; nhập địa chỉ snapshot; COD/ONLINE_MOCK; voucher code, ghi chú, tổng tạm tính.
- **Đang chặn nút “Xác nhận tạo đơn”**, không call `POST /checkout` với actor Admin. Địa chỉ mặc định không tự điền khi BE chưa có DTO; phí giao/voucher/tổng không hiển thị số giả.
- UAT: đúng phone exact; không leakage Manager; customer not found/duplicate; default address; SKU variant + product discount; stock zero/over; no split; voucher coupon and quota; COD/ONLINE_MOCK, retry idempotency; guest invoice and activation; reload detail tied to actual customer.
- BE bàn giao: OpenAPI request/response/errors cho 01–04, migration address và GuestContact nếu cần, audit schema, test P0 security, deployment SHA và UAT credentials riêng qua kênh an toàn.

**Release gate:** Không mở nút tạo đơn hoặc merge production trước khi BE chốt API 03 + 04, địa chỉ default và P0 security guest activation. Phải test live với dữ liệu staging, không dựa dữ liệu Figma.
