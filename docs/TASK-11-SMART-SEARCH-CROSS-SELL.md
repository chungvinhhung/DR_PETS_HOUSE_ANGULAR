# Nhiệm vụ 11 — Tìm kiếm thông minh & gợi ý bán chéo

## 1. Vấn đề trước khi làm

| # | Hiện trạng (đã kiểm tra trên backend Render) | Hậu quả |
|---|---|---|
| 1 | `/search?keyword=thức ăn mèo` → **400 VALIDATION_ERROR** (backend không nhận dấu cách) | Không tìm được cụm từ nhiều chữ |
| 2 | Backend phân biệt dấu: `meo` → 1 kết quả, `mèo` → 66 | Gõ không dấu gần như không ra gì |
| 3 | FE parse sai response `/search` (`results` là object/mảng không có `_type`) và `/search/suggestions` (`{query, suggestions}`) | Trang kết quả và dropdown **luôn rơi về dữ liệu mock** |
| 4 | Dropdown ghi đè sản phẩm gợi ý thật bằng mock | Sản phẩm gợi ý không có thật |
| 5 | Không có gợi ý bán chéo | — |

## 2. Giải pháp

**Tìm kiếm thông minh** — `src/app/core/customer/services/smart-search.ts` (hàm thuần):

1. **Phân tích câu** (`analyzeSearchQuery`): chuẩn hóa, **khôi phục dấu** cho cụm từ ngành thú cưng khi người dùng gõ không dấu (`thuc an cho meo` → `thức ăn cho mèo`), dịch từ tiếng Anh (`dog toy` → `chó đồ chơi`), phân biệt `cho` (giới từ) / `chó`, bỏ stopword.
2. **Tách từ khóa** gửi API: tối đa 3 từ đơn "đặc trưng" nhất (từ chung như `mèo`, `ăn` xếp sau), **gọi song song** rồi gộp theo id.
3. **Xếp hạng lại** (`rankSearchItems`): ưu tiên mục khớp **nhiều từ nhất**, sau đó trọng số trường (tên 3 > danh mục 2 > mô tả 1), thưởng khi cụm từ đứng liền nhau ("sữa tắm"); bỏ mục khớp < 60% số từ. Từ có dấu so khớp có dấu (để `chó` không khớp nhầm `cho`).
4. **Đúng loài**: sản phẩm chỉ dành cho loài khác (vẹt, thỏ…) bị đẩy xuống cuối.

**Gợi ý bán chéo** — `src/app/core/customer/services/cross-sell.service.ts`:

- Nguồn 1: `GET /products/:id/related` của sản phẩm khớp nhất.
- Nguồn 2: **luật theo danh mục** (`CROSS_SELL_RULES`), ví dụ Thức ăn → Đồ dùng thiết yếu, Phụ kiện, Chăm sóc sức khỏe; Chăm sóc & vệ sinh → Đồ dùng, Thức ăn. Lấy sản phẩm bán chạy của danh mục đó.
- Lọc: bỏ sản phẩm đã có trong kết quả, hết hàng, **sai loài**; xen kẽ danh mục cho đa dạng.
- Bán chéo sang **dịch vụ**: thức ăn → "Khám & điều trị"; chăm sóc/vệ sinh → "Grooming & Spa".
- Hiển thị: dropdown ô tìm kiếm (mục **"Thường mua kèm"**, 2 sản phẩm) và trang kết quả (mục **"Thường được mua kèm"**).

File sửa: `search-api.service.ts`, `nav-search-bar.*`, `search-suggestion-dropdown.*`, `mobile-search-panel.component.ts`, `search/pages/search-results-page.*`, `products-section.*`, `search-results-content.*`, `search-results-page.helpers.ts`.

## 3. Kịch bản test

Chuẩn bị: `npm start` → http://localhost:4200. Mở DevTools → tab Network, lọc `search`.
Lần gọi đầu có thể chậm 30–60 giây do backend Render "ngủ".

| ID | Bước | Kết quả mong đợi |
|---|---|---|
| S11-01 | Gõ `pate` vào ô tìm kiếm (không Enter) | Sau ~0.3s dropdown hiện "Gợi ý phù hợp" là tên sản phẩm **thật** (Nước sốt pate cho mèo CIAO…), mục sản phẩm có ảnh và giá thật. Network: `GET /search/suggestions?q=pate` → 200 |
| S11-02 | Tiếp S11-01, nhìn cuối dropdown | Có mục **"Thường mua kèm"** gồm 2 sản phẩm **khác danh mục** (vd. cát vệ sinh / khay vệ sinh cho mèo). Network có `GET /products/<id>/related` và `GET /products?categoryId=…` |
| S11-03 | Gõ `thuc an cho meo` (không dấu, có dấu cách) | Dòng đầu dropdown là gợi ý đã sửa dấu **"thức ăn cho mèo"**. Network gọi `/search/suggestions?q=thức` (một từ), **không có request 400** |
| S11-04 | Enter với `thuc an cho meo` | Trang kết quả hiện **"thức ăn cho mèo"**; các sản phẩm đầu là *Thức ăn cho mèo …*. Network có 3 request `/search?keyword=thức`, `…=mèo`, `…=ăn` (song song) |
| S11-05 | So sánh trên backend | `curl ".../api/v1/search?keyword=thuc%20an%20meo"` → 400; trên FE vẫn ra ~80 kết quả |
| S11-06 | Tìm `sua tam cho cho` | 2 kết quả đầu là **sữa tắm**; "Sữa tắm khô cho **mèo**" không nằm trên đầu |
| S11-07 | Trang kết quả của S11-04, kéo xuống | Có mục **"Thường được mua kèm"**: ô dịch vụ "Khám & điều trị" và lưới sản phẩm cho **mèo** thuộc danh mục khác. **Không** có thức ăn cho vẹt/thỏ |
| S11-08 | Tìm `dog toy` | Hiển thị "chó đồ chơi"; kết quả là đồ chơi cho chó |
| S11-09 | Tìm `kongg` (sai chính tả) | Trang "không có kết quả" bình thường, không lỗi console; không hiện mục bán chéo |
| S11-10 | Bàn phím: gõ `pate`, nhấn ↓ nhiều lần, Enter | Con trỏ đi qua gợi ý → sản phẩm → **sản phẩm mua kèm** → "Xem tất cả"; Enter mở đúng mục |
| S11-11 | Ngắt mạng (DevTools → Offline), gõ `tắm` | Dropdown vẫn hiện dữ liệu mẫu (fallback), không trắng trang |
| S11-12 | Trang kết quả, chọn tab "Sản phẩm" | Số đếm Sản phẩm chỉ tính kết quả khớp, **không cộng** sản phẩm bán chéo |

## 4. Giới hạn đã biết

- Khôi phục dấu dựa trên từ điển ngành (khoảng 50 cụm/từ). Từ ngoài từ điển gõ không dấu vẫn phụ thuộc backend. Đây là lý do nên làm phần BE trong `BE-PROPOSAL-TASK-11-14.md`.
- Mỗi lần tìm gọi tối đa 3 request song song (do backend không nhận dấu cách).
