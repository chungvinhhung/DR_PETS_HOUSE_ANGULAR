# Đề xuất bổ sung Backend cho Nhiệm vụ 11–14

FE đã làm xong phần của mình và **chạy được với API hiện tại**. Các mục dưới đây giúp kết quả chính xác hơn và gọn hơn. Mỗi mục đều độc lập; khi BE làm xong, FE chỉ cần sửa ít.

## P1 — Lỗi cần sửa: `/search` và `/search/suggestions` từ chối từ khóa có dấu cách

```text
GET /api/v1/search?keyword=thuc%20an%20meo  → 400 "Parameter 'keyword' must be url encoded.
                                              Its value may not contain reserved characters."
```

Nguyên nhân có thể nằm ở OpenAPI validator (`allowReserved` / `pattern` của tham số `keyword`, `q`). Hiện FE phải tách thành nhiều request một từ rồi gộp lại.
**Khi sửa xong:** FE gửi nguyên câu, chỉ còn một request.

## P2 — Tìm kiếm không phân biệt dấu + nhiều từ

- Lưu thêm trường `searchText` = `lower(unaccent(name + ' ' + categoryName + ' ' + productCode))` khi tạo/sửa sản phẩm, và đánh index.
- Truy vấn: bỏ dấu từ khóa, tách từ, yêu cầu khớp **tất cả** từ (AND), hoặc dùng MongoDB Atlas Search / text index với `$text` và chấm điểm.
- Kết quả: `meo` = `mèo`, `thuc an cho meo` ra đúng thức ăn cho mèo, không cần từ điển ở FE.

## P3 — Slug sản phẩm thật

- Thêm trường `slug` (unique, sinh từ tên lúc tạo, **không đổi** khi sửa tên; lưu `oldSlugs[]` khi đổi).
- Thêm `GET /products/slug/:slug` → sản phẩm. Nếu là slug cũ thì trả `{ redirectTo: newSlug }` (FE trả 301).
- **Khi có:** FE bỏ đuôi `-i.<id>`, URL thành `/san-pham/bong-gam-kong-classic`.

## P4 — Gợi ý bán chéo theo dữ liệu thật ("Frequently bought together")

`GET /products/:id/related` hiện trả sản phẩm **cùng danh mục** và không xét loài. Ví dụ: tìm pate mèo nhưng nhận gợi ý thức ăn cho vẹt, cỏ cho thỏ.
Đề xuất thêm `GET /products/:id/frequently-bought-together?limit=8`:

1. Từ các đơn hàng `COMPLETED`, đếm số lần sản phẩm B nằm cùng đơn với A (co-occurrence). Chạy job hằng đêm và lưu vào collection `product_associations { productId, relatedId, score }`.
2. Sản phẩm mới hoặc ít dữ liệu: dùng luật danh mục (bảng `CROSS_SELL_RULES` FE đang dùng có thể chuyển thẳng xuống BE) và lọc theo trường `species` (xem P5).
3. Bỏ sản phẩm hết hàng.

**Khi có:** FE gọi một endpoint này thay cho `related` + lấy theo danh mục.

## P5 — Trường `species` cho sản phẩm

Thêm `species: ['CAT' | 'DOG' | 'BIRD' | 'RABBIT' | 'ALL']` và cho phép lọc `GET /products?species=CAT`. FE đang phải đoán loài qua tên sản phẩm.

## P6 — Bearer token an toàn hơn

- **Access token sống ngắn** (10–15 phút) + **refresh token trong cookie `httpOnly; Secure; SameSite=Strict`**, rotate mỗi lần refresh. Áp dụng cho cả **tài khoản khách hàng**, không chỉ admin.
- 401 do hết hạn trả đúng `code: "TOKEN_EXPIRED"`, sai/thu hồi trả `AUTHENTICATION_ERROR`. FE dựa vào đó để biết có nên refresh hay không.
- `POST /auth/logout` thu hồi refresh token và xóa cookie.
- Bước xa hơn (nếu muốn chặn hẳn rủi ro XSS đọc token): chuyển sang mô hình BFF / cookie-session, FE không còn giữ access token.

## P7 — Callback URL cho đăng nhập Google (khi làm)

Endpoint `GET /auth/google?returnUrl=/don-hang-cua-toi` cần lưu returnUrl vào tham số `state` của OAuth, và **chỉ chấp nhận đường dẫn nội bộ** (cùng quy tắc với `core/utils/return-url.ts` ở FE). Sau callback, chuyển về `FE_ORIGIN + returnUrl`.
