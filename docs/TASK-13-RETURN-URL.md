# Nhiệm vụ 13 — Redirect after Login / Return URL / Callback URL

## 1. Luồng

```text
Khách chưa đăng nhập mở /don-hang-cua-toi (gõ URL, F5, link chia sẻ)
  └─ customerAuthGuard → redirect /?auth=login&returnUrl=%2Fdon-hang-cua-toi
       └─ CustomerLayout đọc 2 tham số → mở popup đăng nhập
            ├─ Đăng nhập thành công → navigateByUrl(returnUrl, replaceUrl) → /don-hang-cua-toi
            └─ Đóng popup → bỏ ?auth&returnUrl khỏi URL, ở lại trang chủ

Khách đang dùng app, bấm menu "Đơn hàng của tôi"
  └─ guard mở popup tại chỗ (không đổi trang) → đăng nhập xong mới chuyển tới trang đó

Admin chưa đăng nhập mở /admin/orders/5
  └─ authGuard → /admin/login?returnUrl=%2Fadmin%2Forders%2F5 → đăng nhập → /admin/orders/5

Token admin hết hạn & refresh thất bại khi đang ở /admin/staff
  └─ refreshTokenInterceptor → /admin/login?returnUrl=%2Fadmin%2Fstaff
```

## 2. Bảo mật: chống Open Redirect (`src/app/core/utils/return-url.ts`)

`returnUrl` đến từ URL nên ai cũng sửa được, vì vậy chỉ chấp nhận **đường dẫn nội bộ**:

| Giá trị returnUrl | Khách hàng | Admin |
|---|---|---|
| `/don-hang-cua-toi?tab=1` | ✅ giữ nguyên | ❌ → `/admin/dashboard` |
| `/admin/orders/5` | ❌ → `/` (không cho khách vào khu admin) | ✅ |
| `https://evil.com`, `//evil.com`, `/\evil.com`, `%2F%2Fevil.com`, `javascript:…` | ❌ → `/` | ❌ → `/admin/dashboard` |
| `/admin/login`, `/admin/forbidden` | — | ❌ (tránh vòng lặp) |

## 3. Lỗi đã sửa kèm

- **Trước**: khi refresh token thất bại, khách hàng bị đẩy sang `/admin/login`. **Sau**: khách hàng thấy popup đăng nhập ở trang hiện tại; admin về `/admin/login?returnUrl=<trang đang xem>`.
- **Trước**: khách vào thẳng URL cần đăng nhập thì trang đích chỉ lưu trong bộ nhớ, F5 là mất. **Sau**: trang đích nằm trên URL (`returnUrl`).

File: `core/utils/return-url.ts`, `core/customer/guards/customer-auth.guard.ts`, `customer-auth.service.ts` (`loginWithReturnUrl`, `closeAuth`), `layouts/customer/customer-layout/customer-layout.component.ts`, `core/interceptors/refresh-token.interceptor.ts`, `admin-login-page.component.ts`.

## 4. Kịch bản test

Chuẩn bị: một tài khoản khách hàng và một tài khoản admin trên backend. Trước mỗi ca, đăng xuất hoặc xóa Storage (DevTools → Application → Clear site data).

| ID | Bước | Kết quả mong đợi |
|---|---|---|
| S13-01 | Chưa đăng nhập, gõ `localhost:4200/don-hang-cua-toi` | URL thành `/?auth=login&returnUrl=%2Fdon-hang-cua-toi`, popup đăng nhập mở |
| S13-02 | Tiếp S13-01, đăng nhập đúng | Tự chuyển tới `/don-hang-cua-toi`; URL sạch (không còn `auth`, `returnUrl`); bấm Back **không** quay lại `/?auth=login…` |
| S13-03 | Lặp S13-01 nhưng **F5** khi popup đang mở, rồi đăng nhập | Popup mở lại sau F5; đăng nhập xong vẫn vào `/don-hang-cua-toi` |
| S13-04 | Lặp S13-01 nhưng bấm X / Esc đóng popup | URL về `/`, ở trang chủ, không bị đẩy vào trang cần đăng nhập |
| S13-05 | Chưa đăng nhập, đang ở trang chủ, mở menu → "Thú cưng của tôi" | Popup mở **tại chỗ**, URL không đổi; đăng nhập xong → `/thu-cung-cua-toi` |
| S13-06 | Chưa đăng nhập, mở `/thu-cung-cua-toi/123/chinh-sua?x=1` | Đăng nhập xong về đúng `/thu-cung-cua-toi/123/chinh-sua?x=1` (giữ cả path con và query) |
| S13-07 | Chưa đăng nhập, mở `/?auth=login&returnUrl=https://evil.com` rồi đăng nhập | Ở lại `/`, **không** sang evil.com |
| S13-08 | Như S13-07 với `returnUrl=//evil.com` và `returnUrl=%2F%2Fevil.com` | Như S13-07 |
| S13-09 | Như S13-07 với `returnUrl=/admin/users` (tài khoản khách) | Về `/`, không vào khu admin |
| S13-10 | **Đã** đăng nhập khách, mở `/?auth=login&returnUrl=/lich-su-dat-lich` | Không hiện popup, chuyển thẳng tới `/lich-su-dat-lich` |
| S13-11 | Admin chưa đăng nhập, mở `/admin/orders` | Sang `/admin/login?returnUrl=%2Fadmin%2Forders`; đăng nhập xong vào `/admin/orders` |
| S13-12 | Mở `/admin/login?returnUrl=https://evil.com` rồi đăng nhập admin | Vào `/admin/dashboard` |
| S13-13 | Mở `/admin/login?returnUrl=/thong-tin-nguoi-dung` rồi đăng nhập admin | Vào `/admin/dashboard` (returnUrl admin chỉ chấp nhận `/admin/…`) |
| S13-14 | Đăng nhập khách, xóa cookie refresh (Application → Cookies), sửa `accessToken` thành token hết hạn (xem S14-06), vào `/don-hang-cua-toi` | Popup đăng nhập khách mở, **không** bị chuyển tới `/admin/login` |
