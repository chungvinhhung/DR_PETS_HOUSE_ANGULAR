# Nhiệm vụ 14 — Bearer Token

## 1. Cơ chế

```text
Đăng nhập (POST /auth/login) → { accessToken } (+ cookie httpOnly refresh token do backend set)
  └─ AuthSessionService.accessToken (signal, bộ nhớ)
       + lưu sessionStorage (mặc định) hoặc localStorage (khi chọn "Ghi nhớ đăng nhập", 30 ngày)

Mọi request HttpClient
  └─ authInterceptor
       ├─ URL không thuộc environment.apiBaseUrl → KHÔNG gắn token (không lộ sang CDN, Google…)
       ├─ /auth/login, /auth/refresh            → KHÔNG gắn token
       ├─ JWT exp đã/sắp hết (≤30s)             → POST /auth/refresh trước rồi mới gửi
       └─ còn lại                               → Authorization: Bearer <accessToken>
  └─ refreshTokenInterceptor: 401 TOKEN_EXPIRED → refresh 1 lần (dùng chung, không gọi trùng) → gửi lại
       └─ refresh thất bại → admin: /admin/login?returnUrl=… ; khách: popup đăng nhập
```

## 2. Thay đổi

| Hạng mục | Trước | Sau |
|---|---|---|
| Lưu token khi **không** chọn "Ghi nhớ" | Ghi vào **cả localStorage** (vẫn còn sau khi đóng trình duyệt) | Chỉ sessionStorage, đóng tab là mất |
| Khôi phục token sau F5 | Lấy từ bất kỳ kho nào | Chỉ từ kho đang giữ phiên |
| Token được refresh | Chỉ cập nhật trong bộ nhớ; F5 lại dùng token cũ đã hết hạn | Ghi đè vào storage |
| Token hết hạn | Gửi đi, chờ 401 rồi mới refresh | Kiểm tra `exp` của JWT, refresh **trước** khi gửi |
| Phiên khách hết hạn (401) | Token cũ vẫn nằm trong bộ nhớ | Xóa token, mở popup đăng nhập |
| Refresh thất bại ở trang khách | Bị đẩy sang `/admin/login` | Popup đăng nhập khách (xem NV13) |

File: `core/interceptors/auth.interceptor.ts`, `core/interceptors/refresh-token.interceptor.ts`, `core/utils/jwt.ts`, `core/customer/services/customer-auth.service.ts`.

> `core/utils/jwt.ts` chỉ **đọc** `exp` để biết khi nào cần refresh. Việc xác thực chữ ký token luôn do backend làm.

## 3. Kịch bản test

Chuẩn bị: DevTools → Network (bật "Preserve log"), Application → Storage.

| ID | Bước | Kết quả mong đợi |
|---|---|---|
| S14-01 | Đăng nhập khách **không** tick "Ghi nhớ" | Application: `accessToken` + `drPetAuthSession` nằm trong **Session Storage**; Local Storage **không có** `accessToken` |
| S14-02 | Đăng xuất, đăng nhập lại **có** tick "Ghi nhớ" | Token nằm trong **Local Storage**, Session Storage không có |
| S14-03 | Sau S14-01, vào "Đơn hàng của tôi", xem request `GET /api/v1/orders` → Headers | Có `Authorization: Bearer eyJ…` |
| S14-04 | Cùng trang, xem request tải ảnh sản phẩm (product.hstatic.net, petmart.vn…) | **Không** có header Authorization |
| S14-05 | Xem request `POST /auth/login` | **Không** có header Authorization |
| S14-06 | Giả lập token hết hạn: chạy đoạn script dưới trong Console rồi để trang reload | Network: `POST /auth/refresh` xuất hiện **trước** `GET /orders`. Refresh 200 → `/orders` gửi kèm token **mới**, và token mới được lưu lại vào Storage. Refresh lỗi → `/orders` trả 401 → popup đăng nhập khách |
| S14-07 | Mở 3 trang cần đăng nhập liên tiếp với token hết hạn (như S14-06) | Chỉ có **1** request `/auth/refresh` cho các request đồng thời |
| S14-08 | Sau S14-01, đóng hẳn tab/trình duyệt, mở lại trang | Đã bị đăng xuất (token sessionStorage đã mất) |
| S14-09 | Sau S14-02, đóng trình duyệt, mở lại | Vẫn đăng nhập; request API vẫn có Bearer |
| S14-10 | Bấm Đăng xuất | Cả 2 storage không còn `accessToken`; request sau đó không có Authorization |
| S14-11 | Admin: đăng nhập `/admin/login`, mở `/admin/orders` | Request `GET /orders` có Bearer token của admin |
| S14-12 | Kiểm tra backend bằng curl | `curl .../api/v1/orders` → 401 `AUTHENTICATION_ERROR`; `curl -H "Authorization: Bearer <token copy từ S14-03>" .../api/v1/orders` → 200 |

Script cho S14-06 (đổi `exp` của token thành 1 phút trước; chữ ký trở nên sai, nên đây là cách thử phía FE):

```js
const store = sessionStorage.getItem('accessToken') ? sessionStorage : localStorage;
const [h, p, s] = store.getItem('accessToken').split('.');
const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
payload.exp = Math.floor(Date.now() / 1000) - 60;
const b64 = btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
store.setItem('accessToken', [h, b64, s].join('.'));
location.reload();
```

## 4. Lưu ý

- Access token vẫn nằm trong Web Storage, nên nếu trang bị XSS thì token có thể bị đọc. Cách an toàn hơn cần backend hỗ trợ (xem `BE-PROPOSAL-TASK-11-14.md`).
- Phía khách cần backend set cookie refresh khi đăng nhập thì refresh tự động mới hoạt động. Nếu không, khi hết hạn khách sẽ được yêu cầu đăng nhập lại (S14-06, nhánh lỗi).
