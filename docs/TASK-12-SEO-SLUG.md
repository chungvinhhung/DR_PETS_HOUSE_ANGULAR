# Nhiệm vụ 12 — Slug tìm kiếm & sản phẩm chuẩn SEO

## 1. Thiết kế URL

| Trang | URL cũ | URL mới (canonical) |
|---|---|---|
| Chi tiết sản phẩm | `/product-details/6af00f898b30ca61988e133e` | `/san-pham/bong-gam-cao-su-tu-nhien-huan-luyen-cho-kong-classic-i.6af00f898b30ca61988e133e` |
| Viết đánh giá | `/product-details/:id/write-review` | `/san-pham/:slug/viet-danh-gia` (URL cũ vẫn chạy) |
| Kết quả tìm kiếm | `/search?q=thức ăn cho mèo` | `/tim-kiem/thuc-an-cho-meo` (bộ lọc: `?type=shopping&sort=priceAsc`) |

- Backend **không có trường `slug`**, nên FE tự sinh slug từ tên (bỏ dấu, chữ thường, nối bằng `-`, tối đa 80 ký tự, cắt ở ranh giới từ) và gắn `-i.<id>` ở cuối (quy ước giống Shopee). FE đọc id từ phần cuối nên **đổi tên sản phẩm vẫn không gãy link**.
- URL cũ và URL có slug lỗi thời **tự chuyển (replace) sang URL chuẩn**. Mỗi sản phẩm chỉ có một địa chỉ, tránh trùng lặp nội dung.
- Tìm kiếm: path chứa slug không dấu; câu gốc có dấu được truyền qua `history.state`, nên khi gõ ở ô tìm kiếm không bị mất dấu. Khi vào từ Google / link chia sẻ, SmartSearch (NV11) tự khôi phục dấu.

## 2. Thẻ SEO (`src/app/core/customer/services/seo.service.ts`)

| Thẻ | Trang sản phẩm | Trang tìm kiếm |
|---|---|---|
| `<title>` | `<Tên SP> - <Danh mục> \| Dr. Pet's House` | `Tìm kiếm "<từ khóa>" \| Dr. Pet's House` |
| `meta description` | Mô tả SP, cắt ≤160 ký tự ở ranh giới từ | "N kết quả cho …" |
| `link rel=canonical` | URL slug tuyệt đối | `/tim-kiem/<slug>` (bỏ query lọc) |
| `meta robots` | `index,follow` | `noindex,follow` khi có bộ lọc hoặc 0 kết quả |
| Open Graph | `og:title/description/url/image`, `og:type=product` | `og:type=website` |
| JSON-LD | `schema.org/Product`: tên, ảnh, SKU, giá VND, tình trạng kho, sao đánh giá | — |

Khi rời trang, các thẻ được reset về mặc định.

File chính: `shared/customer/utils/slug.ts`, `seo.service.ts`, `customer.routes.ts`, `product-details-page.component.ts`, `product-card.helpers.ts`, `cart-item-row.component.ts`, `search-results-page.component.ts`.

## 3. Kịch bản test

| ID | Bước | Kết quả mong đợi |
|---|---|---|
| S12-01 | Vào `/petshop`, bấm một sản phẩm | URL có dạng `/san-pham/<ten-khong-dau>-i.<id>`, toàn chữ thường, không dấu, không ký tự lạ |
| S12-02 | Mở `/product-details/6af00f898b30ca61988e133e` | Trang hiện sản phẩm KONG, URL **tự đổi** thành `/san-pham/bong-gam-cao-su-tu-nhien-huan-luyen-cho-kong-classic-i.6af00f…`. Bấm Back **không** quay lại URL cũ (replace) |
| S12-03 | Mở `/san-pham/ten-sai-bat-ky-i.6af00f898b30ca61988e133e` | Vẫn ra đúng sản phẩm, URL tự sửa về slug đúng |
| S12-04 | Ở trang sản phẩm, DevTools → Elements → `<head>` | Có `<title>` chứa tên SP, `meta[name=description]`, `link[rel=canonical]` trỏ URL slug tuyệt đối, `meta[property^=og:]`, `script#seo-json-ld` |
| S12-05 | Copy nội dung `script#seo-json-ld`, dán vào https://validator.schema.org | Nhận diện `Product` có `offers.price`, `priceCurrency=VND`, không lỗi |
| S12-06 | Từ trang sản phẩm bấm sang trang Liên hệ | `<title>` đổi về mặc định / title của trang đó; không còn `canonical`, JSON-LD của sản phẩm cũ |
| S12-07 | Gõ `Thức ăn cho mèo` ở ô tìm kiếm, Enter | URL = `/tim-kiem/thuc-an-cho-meo`; tiêu đề trang hiện "thức ăn cho mèo" **có dấu** |
| S12-08 | F5 trang S12-07 | Vẫn hiện đúng "thức ăn cho mèo" (state giữ khi reload) |
| S12-09 | Mở tab mới, dán trực tiếp `/tim-kiem/sua-tam-cho-cho` | Tìm được sữa tắm cho chó (dấu được khôi phục từ slug) |
| S12-10 | Mở `/search?q=pate mèo` | URL tự đổi thành `/tim-kiem/pate-meo`, kết quả "pate mèo"; Network chỉ có **một** đợt request tìm kiếm |
| S12-11 | Trang tìm kiếm, chọn tab Sản phẩm + sắp xếp giá tăng | URL `/tim-kiem/<slug>?type=shopping&sort=priceAsc`; `meta robots` = `noindex,follow`; canonical vẫn là `/tim-kiem/<slug>` |
| S12-12 | Thêm sản phẩm vào giỏ, mở giỏ, bấm tên sản phẩm | Đi tới URL slug của sản phẩm |
| S12-13 | Ngắt mạng, mở `/san-pham/abc-i.1` | Hiển thị dữ liệu mẫu, không lỗi trắng trang |

## 4. Giới hạn: app đang render phía client (CSR)

Googlebot chạy JavaScript nên đọc được title, canonical và JSON-LD. Bot của **Facebook / Zalo / Messenger không chạy JS**, nên khi chia sẻ link sẽ chỉ thấy thẻ mặc định trong `index.html`.
Muốn preview chia sẻ đúng cần bật **SSR / prerender** (`ng add @angular/ssr`). Đây là thay đổi hạ tầng lớn (cần server Node, cấu hình lại Vercel) nên chưa làm trong nhiệm vụ này.
