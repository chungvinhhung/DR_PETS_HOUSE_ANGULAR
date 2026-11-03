# WEB 2 — BE handoff: Xóa vĩnh viễn sản phẩm đã lưu trữ

## Hiện trạng

- Trang `/admin/products`, tab **Đã lưu trữ** đã chuyển cột Thao tác sang menu ba chấm, gồm `Khôi phục`, `Chỉnh sửa`, `Xóa vĩnh viễn`.
- `POST /products/:id/restore` đã có và FE đang dùng.
- Source BE hiện tại ở `feat/foundation-v6` **chưa có API xóa vĩnh viễn** (chỉ có `archive` và `restore`).
- FE đã bổ sung adapter `DELETE /products/:id` và modal xác nhận. Nếu BE không hỗ trợ, FE hiển thị lỗi; tuyệt đối không giả lập thành công hay tự xóa row khỏi danh sách.

## Yêu cầu API

**Đề xuất:** `DELETE /api/v1/products/:id` — Bearer token, role **ADMIN**, header `Idempotency-Key`.

Điều kiện:
1. Chỉ cho phép xóa vĩnh viễn Product đang ở trạng thái `ARCHIVED`. Sản phẩm đang `ACTIVE` hoặc `INACTIVE` phải yêu cầu lưu trữ trước.
2. Trước khi xóa, kiểm tra tham chiếu trong đơn hàng, chi tiết giao dịch, trả hàng/hoàn tiền, tồn kho theo chi nhánh, chứng từ nhập xuất kho và các liên kết dữ liệu khác. Nếu còn tham chiếu không thể xóa an toàn thì từ chối với `409 PRODUCT_IN_USE` (chi tiết lý do), không phá vỡ lịch sử nghiệp vụ.
3. Bảo toàn dữ liệu lịch sử theo yêu cầu kế toán/đối soát; thống nhất rõ khi nào được **hard delete**, khi nào chỉ nên **ẩn/soft-delete**.
4. Tác vụ xóa cần kiểm soát đồng thời để không thể phát sinh một giao dịch tham chiếu sản phẩm trong lúc xóa. Nếu nhiều collection liên quan thì thực hiện atomically (MongoDB transaction).
5. Response thành công `204 No Content` (hoặc `200` cùng mã xác nhận); lỗi `403` khi không có quyền, `404` khi không tồn tại, `409` nếu còn tham chiếu, `422` nếu chưa archived.
6. Idempotency-Key phải tránh thực hiện nhiều lần khi FE retry cùng yêu cầu. Không gửi response thành công nếu mutation chưa commit.

## Kiểm thử chấp nhận

- Sản phẩm archived, không có tham chiếu: xóa thành công và không xuất hiện trong `GET /products?status=ARCHIVED`.
- Sản phẩm archived đã nằm trong đơn hàng/tồn kho/chứng từ: trả `409`, giữ nguyên toàn bộ dữ liệu.
- Sản phẩm ACTIVE/INACTIVE: từ chối; không được tự archive rồi xóa.
- Tài khoản không phải ADMIN: `403`.
- Hai yêu cầu xóa đồng thời / retry khi timeout: idempotency đúng, không lỗi không xác định.
- Sau khi xóa thành công, giao diện hiện toast và tự làm mới bảng + tổng số bản ghi.

**FE hiện tại:** Chỉ mở xác nhận khi nhấn `Xóa vĩnh viễn`, gọi API sau khi người dùng xác nhận; khi API chưa có, dialog giữ mở và báo lỗi tương ứng. Không thay đổi nút Chỉnh sửa / Khôi phục của tab hiện tại.
