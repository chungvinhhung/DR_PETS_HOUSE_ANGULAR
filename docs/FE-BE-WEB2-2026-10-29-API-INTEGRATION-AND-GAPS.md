# WEB 2 — Đối chiếu BE handoff ngày 28/10/2026 và FE tích hợp ngày 29/10

## Căn cứ và giới hạn
- Tài liệu FE→BE: `WEB2_BE_HANDOFF_FULL_AUDIT_2026-10-27 (3).docx` — P0-01..P0-06, P1-01..P1-10 và UAT matrix.
- Tài liệu BE→FE: `BAO-CAO-BAN-GIAO-FE-WEB2-TOAN-DIEN.md` (28/10) — BE thông báo 282/282 tests, Atlas seeded, Admin quote/create, Return inspection, Voucher search, exact phone lookup. Đây là **tuyên bố trong tài liệu**, không phải bằng chứng runtime đã xác minh từ FE.
- BE đối chiếu source: `minhllk24/PET_CLINIC_BACKEND` nhánh `feat/foundation-v6` @ `db629e4f261ca7eb867249c2173dd2ac33e20175` (29/10 11:24 ICT).
- FE tích hợp: `chungvinhhung/DR_PETS_HOUSE_ANGULAR` nhánh `feature/admin-appointments-figma` PR #33.
- FE environment vẫn trỏ `https://pet-clinic-backend-a4lj.onrender.com/api/v1`. Chưa xác minh được deployed SHA trên domain này; không tự ý chuyển sang domain ví dụ `petclinic-api.yourdomain.com` trong tài liệu BE.
- Không cung cấp lại, commit hoặc log mật khẩu chung/test account được BE đưa trong tài liệu. BE nên đổi mật khẩu chia sẻ và dùng kênh riêng cho UAT nếu đã phát tán rộng.

## FE đã nối / triển khai
| Hạng mục | FE thực hiện | Giới hạn |
|---|---|---|
| P1-05 | `GET /customers?exactPhone=<phone>` server-side; FE kiểm tra số chuẩn hóa trước khi dùng dữ liệu | Chỉ trả Registered Customer; GuestContact không được xem như Customer |
| P1-04 | Voucher `GET /vouchers?search=&scope=&status=&limit=&cursor=` với search server-side; DTO hỗ trợ minOrderAmount/maxDiscountAmount/description | Đã cập nhật danh sách; những phần form Voucher khác cần UAT |
| P0-04 Quote | `POST /admin/orders/quote`, body **theo source**: `branchId,customerId?,items[{productId,variantId,quantity}],voucherCode?`. Đọc `pricing,availability,quoteExpiresAt` và giới hạn hiệu lực; chọn chi nhánh trước | Nên đối soát JSON response trên Render |
| P0-04 Commit | `POST /admin/orders` với `Idempotency-Key`, chỉ sau quote, modal xác nhận. Thực hiện qua UI cho **ADMIN + Customer đã có tài khoản**, theo source branchId, address/contact | Guest và Manager/Staff write chưa mở vì P0 BE cần xác nhận |
| P1-02/03 | Return DTO thêm `code,orderCode,fulfillmentBranchId,createdAt,allowedActions,quality,receivedQty`; dialog receive phải nhập từng SKU qty (kể cả 0) và quality, có validation `0<=receivedQty<=requestedQty`. `POST /order-returns/:id/receive` truyền items và note | BE cần validate cùng bất biến; không tin kiểm tra client |
| Các hạng mục khác | Giữ code FE hiện hữu để không làm mất luồng Đơn hàng/Voucher/Chi nhánh/Kho | Chưa đánh dấu UAT E2E hoàn thành |

## Lệch contract / BE cần sửa hoặc xác nhận (ưu tiên P0)
1. **Admin Order docs vs source:** handoff dùng `fulfillmentBranchId` trong quote/create, nhưng `order.service.js#quoteAdminOrder/createAdminOrder` destructure `branchId`. FE đã gửi `branchId` theo source; BE cần chốt schema trong OpenAPI và sample JSON thực tế.
2. **Voucher trong quote/commit:** `order.service.js` gọi `validateVoucherEligibility({code,targetType:'ORDER',orderAmount,...})` nhưng hàm hiện định nghĩa `({code,scope,subtotal=0,...})`. Ngoài ra có đoạn gọi `calculateDiscount(appliedVoucher,merchandiseSubtotal)` trong khi helper được định nghĩa `({voucher,subtotal})`. BE cần sửa callsites, test mã có giảm thật và mã không hợp lệ (không âm thầm discount=0 rồi vẫn tạo Order). FE không cho commit khi đã nhập mã mà quote giảm 0.
3. **Branch fail-closed:** `quoteAdminOrder/createAdminOrder` chứa điều kiện `if(allowedBranches.length > 0 && !allowedBranches.includes(...))`; tài khoản MANAGER/STAFF không branch có thể bypass scope trong service. FE tạm giới hạn commit Admin; BE cần fix service, test unassigned 403. Không dùng guard FE thay cho kiểm tra BE.
4. **GuestContact trước transaction:** `createAdminOrder` có thể `GuestContact.create` trước khi bắt đầu transaction tạo order. Nếu create Order thất bại, có khả năng GuestContact vẫn tồn tại. Chốt atomic guest+order+payment+inventory hoặc có cơ chế compensation, không tạo invite thất bại.
5. **Return receive input:** `receiveReturn` hiện mutate `receivedQty,quality` nếu có, không thấy validate ràng buộc số lượng >=0, <=requestedQty hay enum quality ở service. BE phải enforce 400/422 và audit; FE không thể bảo vệ request trực tiếp.
6. **Return formatter:** `receivedQty` fallback `requestedQty` khi chưa ghi kiểm hàng. BE nên trả null cho REQUESTED/PROCESSING để tránh hiểu nhầm đã nhận đủ.
7. **Order/Return details auth:** kiểm tra lại branch scope và guest ownership trên source mới, xác nhận 401/403 với tài khoản ngoài chi nhánh, 0 branch. Không dựa vào tuyên bố test tổng hợp.
8. **Deploy:** xác nhận Render URL, deployed SHA, Atlas alias, seed version/counts, CORS localhost:3001; chứng minh unauthenticated GET and manager unassigned blocked. Không chia sẻ token/mật khẩu trong ticket.

## UAT thực tế cần chạy sau build FE
- Admin existing Customer, 1 SKU tồn tại: quote hiển thị subtotal/shipping/total rồi **xác nhận chủ động** -> tạo đúng 1 Order, 1 Payment, inventory trừ 1 lần, reload danh sách.
- COD vs ONLINE_MOCK: phương thức payment và status theo source; chú thích ONLINE_MOCK chỉ mô phỏng, không thu tiền thật.
- 2 lần click / retry cùng Idempotency-Key: chỉ một Order.
- Nhập Voucher còn hiệu lực: quote giảm đúng và commit đúng; Voucher expired/quota=1: không tạo giao dịch áp sai ưu đãi.
- Manager không chi nhánh / manager ngoài branch: quote/commit 403 (BE fix trước).
- Order/Return list/detail customer khác, anonymous: 401/403, không lộ contactSnapshot.
- Return REQUESTED→PROCESSING→RECEIVED (mỗi SKU qty,quality) → APPROVED → REFUNDED; DAMAGED không tái nhập kho, RESELLABLE tái nhập đúng số.
- Voucher search code/name ở trang >1, cursor/totalCount đúng.
- Sai / thiếu số điện thoại: exactPhone không tìm ra khách gần giống; guest không bị tự gán customerId.
- Rà soát trên cùng FE revision + BE deployed SHA và một DB staging. **Angular build PASS không thay thế E2E.**

## Trạng thái phát hành
- PR #33 giữ **Draft**, chưa merge main/dev.
- Quote/read có thể test sau khi xác nhận domain; Admin create/Return receive là thao tác ghi thật, chỉ thực hiện trên staging/DB reset và sau xác nhận BE đã deploy bản phù hợp.
- Các hạng mục toàn WEB 2 ngoài nhóm Order/Return/Voucher/Lookup chưa được coi là tích hợp xong trong PR này.
