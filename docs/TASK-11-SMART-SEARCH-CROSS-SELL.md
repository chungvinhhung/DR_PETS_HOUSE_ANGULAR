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

**Tìm trong MÔ TẢ sản phẩm** (bổ sung) — `src/app/core/customer/services/product-search-index.service.ts`:

- Kiểm tra backend: `/search` có tìm trong mô tả nhưng **phân biệt dấu** (`tieu hoa` không ra "tiêu hóa"); `/search/suggestions` **chỉ tìm theo tên** (`stress` → 0 gợi ý dù mô tả sản phẩm KONG có chữ này).
- FE tải gọn toàn bộ catalog (id, tên, danh mục, **mô tả**, giá, ảnh) **một lần mỗi phiên**: 2 request, cache 10 phút trong sessionStorage, tải sẵn khi người dùng bấm vào ô tìm kiếm. Chỉ bật khi catalog ≤ 600 sản phẩm.
- Tìm trên tên + danh mục + mô tả: gõ không dấu thì so khớp không dấu, gõ có dấu thì so khớp có dấu. Có điểm thưởng khi cụm từ ("tiêu hóa", "rụng lông") đứng liền nhau trong mô tả. Từ ngắn ≤ 3 ký tự phải khớp nguyên từ.
- Kết quả được **gộp** với kết quả backend rồi xếp hạng chung: khớp tên được ưu tiên hơn khớp mô tả.
- Sản phẩm khớp **nhờ mô tả** (từ khóa không có trong tên/danh mục) hiển thị đoạn trích **"Trong mô tả: …[từ khóa]…"** có tô vàng, ở cả trang kết quả lẫn dropdown. Phần tô sáng được render bằng `@for` với từng `<span>`, không dùng `innerHTML`, nên mô tả sản phẩm không thể chèn mã độc.
- Nếu chỉ mục tải quá 8 giây hoặc lỗi thì bỏ qua, vẫn dùng kết quả backend. Nếu backend lỗi mà chỉ mục có kết quả thì vẫn hiển thị kết quả từ chỉ mục.

Kết quả đo trên catalog thật (122 sản phẩm):

| Từ khóa | Backend | Chỉ mục FE | Ví dụ khớp nhờ mô tả |
|---|---|---|---|
| `tieu hoa` | 10 (khớp rời "tieu"/"hoa", phần lớn không liên quan) | 20 (19 nhờ mô tả) | Bát ăn PetBowl: "…hỗ trợ **tiêu hóa** tốt hơn…" |
| `rung long` | 7 | 5, cả 5 nhờ mô tả | Dây dắt HAND IN HAND: "…giảm sự **rụng lông**…" |
| `stress` (dropdown) | 0 gợi ý | 1 | KONG Classic: "…giúp chó xả **stress**…" |
| `omega` | 9 | 9 (7 nhờ mô tả) | Whiskas: "…bổ sung **Omega** 3 & 6…" |

File sửa: `product-search-index.service.ts` (mới), `smart-search.ts` (`filterByTerms`, `buildMatchSnippet`, `describeMatch`), `products-grid.*`, `product-suggestion-card.*`, `search-api.service.ts`, `nav-search-bar.*`, `search-suggestion-dropdown.*`, `mobile-search-panel.component.ts`, `search/pages/search-results-page.*`, `products-section.*`, `search-results-content.*`, `search-results-page.helpers.ts`.

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
| S11-13 | Bấm vào ô tìm kiếm (chưa gõ gì) | Network có 2 request `GET /products?page=1&limit=100` và `page=2` (tải chỉ mục). Bấm lần nữa / F5 trong 10 phút thì **không** tải lại (Application → Session Storage có `drPetProductSearchIndex`) |
| S11-14 | Tìm `tieu hoa` (không dấu) | Có các sản phẩm như *Bát ăn PetBowl*, *Cỏ khô Alfalfa* dù tên không chứa từ này; dưới thẻ có dòng **"Trong mô tả: …hỗ trợ [tiêu hóa]…"**, chữ "tiêu hóa" tô vàng |
| S11-15 | Gõ `stress` vào ô tìm kiếm (không Enter) | Dropdown hiện sản phẩm **KONG Classic** kèm dòng trích "…xả **stress**…" (API gợi ý của backend trả 0) |
| S11-16 | Tìm `rung long` | Ra dây dắt HAND IN HAND, gel vitamin… với đoạn trích "giảm **rụng lông**" |
| S11-17 | Tìm `pate` | Sản phẩm **tên** có "pate" xếp trước KONG Classic (chỉ có "pate" trong mô tả); thẻ pate **không** có dòng "Trong mô tả" |
| S11-18 | Tìm `ăn` | Đoạn trích không tô "ăn" bên trong "ch**ăn**" (từ ngắn chỉ khớp nguyên từ) |
| S11-19 | DevTools → Network → chặn URL `*products?page=*` rồi tìm `pate` | Sau tối đa 8 giây vẫn ra kết quả từ backend, không treo, không lỗi console |

## 4. Giới hạn đã biết

- Khôi phục dấu dựa trên từ điển ngành (khoảng 50 cụm/từ). Từ ngoài từ điển gõ không dấu vẫn phụ thuộc backend. Đây là lý do nên làm phần BE trong `BE-PROPOSAL-TASK-11-14.md`.
- Mỗi lần tìm gọi tối đa 3 request song song (do backend không nhận dấu cách).
- Chỉ mục FE phù hợp với catalog nhỏ (hiện 122 sản phẩm, khoảng 950KB dữ liệu gốc mỗi phiên). Khi vượt 600 sản phẩm, chỉ mục tự tắt và chỉ còn dùng backend. Lúc đó cần backend làm mục P2 trong đề xuất.
