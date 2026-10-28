# Giao diện Khách hàng (Customer) — Cấu trúc sau khi chuyển từ React sang Angular 22

> Tài liệu này giải thích **mỗi file nằm ở đâu, làm gì** để bạn đọc, sửa và nâng cấp phần Customer.
> Bản gốc: dự án React/Vite `WEB2_PET_CLINIC-FRONTEND` (Tailwind, React Router, Context API).
> Bản mới: chạy chung app Angular với phần Admin, theo đúng quy ước của repo (`core/`, `shared/`, `layouts/`, `features/`),
> và **mọi file của Customer đều nằm trong thư mục con `customer/`** để tách bạch với phần Admin của bạn cùng nhóm.

---

## 1. Chạy thử

```bash
npm install
npm start            # http://localhost:4200  (trang chủ khách hàng)
npm run build        # build production
```

- API: lấy từ `src/environments/environment*.ts` → `apiBaseUrl` (dùng chung với Admin).
- Khi API lỗi mạng (không kết nối được back-end) ở chế độ dev, nhiều trang tự dùng **dữ liệu mẫu** giống bản React
  (ví dụ: sản phẩm, thú cưng, đơn hàng, đăng nhập "giả").
- Muốn xem giao diện đã đăng nhập mà không cần back-end: đặt `TEST_AUTHENTICATED = true` trong
  `core/customer/constants/dev-flags.ts`, hoặc bấm ĐĂNG NHẬP và nhập bất kỳ (khi back-end không phản hồi).

## 2. Sơ đồ thư mục

```text
src/app/
├── app.routes.ts                      # route gốc: '' -> CustomerLayout + customer.routes.ts (Admin giữ nguyên)
├── core/customer/                     # "bộ não" dùng chung toàn bộ Customer (singleton)
│   ├── constants/                     # hằng số: cờ dev, hồ sơ mặc định
│   ├── guards/                        # customerAuthGuard: chặn trang cần đăng nhập
│   └── services/
│       ├── customer-http.service.ts   # gọi API (thay axios) -> ApiClientService của core
│       ├── customer-auth.service.ts   # đăng nhập / hồ sơ (thay AuthContext)
│       ├── cart.service.ts            # giỏ hàng + popup thanh toán (thay CartContext)
│       ├── customer-notification.service.ts
│       ├── decision-modal.service.ts  # popup xác nhận dùng chung
│       ├── customer-navigation.service.ts  # thay useNavigate/useLocation/useParams/useSearchParams
│       └── api/*.service.ts           # 1 file/1 nhóm API (thay thư mục services/ của React)
├── shared/customer/                   # thứ tái sử dụng nhiều nơi, KHÔNG chứa nghiệp vụ riêng
│   ├── assets/*.ts                    # bảng đường dẫn ảnh (ảnh thật nằm ở public/assets/customer/)
│   ├── components/                    # nút, thẻ sản phẩm, breadcrumb, canvas, icon, popup xác nhận...
│   ├── data/                          # dữ liệu mẫu dùng ở nhiều trang (sản phẩm, blog, tìm kiếm...)
│   ├── directives/                    # appCustomerLink, appStyle, selectValue
│   ├── pipes/                         # trustResourceUrl
│   ├── styles/customer.scss           # Tailwind + CSS toàn cục của Customer
│   └── utils/                         # tiền tệ, tìm kiếm, đếm ngược, carousel...
├── layouts/customer/                  # "khung" trang
│   ├── customer-layout/               # khung gốc: nạp CSS, router-outlet, các popup toàn site
│   ├── account-layout/                # khung trang tài khoản (có sidebar) — thay LayoutManagePet
│   ├── components/navbar|footer|sidebar|notifications/
│   ├── constants/                     # menu điều hướng, menu tài khoản
│   └── data/                          # dữ liệu mẫu thông báo
└── features/customer/                 # từng chức năng (mỗi thư mục = 1 nhóm nghiệp vụ)
    ├── customer.routes.ts             # TẤT CẢ đường dẫn của Customer
    ├── home/ shop/ products/ cart/ checkout/ booking/ pets/ orders/ profile/
    ├── blog/ rescue/ search/ about/ contact/ policy/ clinic-services/ auth/ not-found/
    │   ├── pages/                     # trang (gắn với route)
    │   ├── components/                # component con của chức năng
    │   ├── data/ assets/ utils/       # dữ liệu/ảnh/hàm riêng của chức năng
    │   └── *.helpers.ts               # hằng số & hàm dùng chung cho các component cùng thư mục
public/assets/customer/                # toàn bộ ảnh, font của Customer (copy từ src/assets của React)
tailwind.config.js                     # Tailwind v3, chỉ quét thư mục customer/
```

**Quy tắc đặt file mới**

| Bạn muốn thêm…                                   | Đặt ở                                                     |
| ------------------------------------------------ | --------------------------------------------------------- |
| Một trang mới                                    | `features/customer/<chức-năng>/pages/` + khai báo trong `customer.routes.ts` |
| Component chỉ dùng trong 1 chức năng             | `features/customer/<chức-năng>/components/`               |
| Component dùng ở nhiều chức năng                 | `shared/customer/components/<tên>/`                       |
| Gọi API mới                                      | thêm hàm vào `core/customer/services/api/<nhóm>-api.service.ts` |
| Trạng thái dùng chung toàn site (giống Context)  | service mới trong `core/customer/services/`              |
| Ảnh mới                                          | `public/assets/customer/images/...` + khai báo trong `shared/customer/assets/*.ts` |
| Icon mới                                         | thêm SVG vào `shared/customer/components/icon/customer-icons.ts` |

## 3. Từ React sang Angular — đọc code thế nào?

| React (cũ)                                   | Angular (mới)                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `function X({ a, onClose })`                 | `class XComponent { a = input(); onClose = output(); }`                       |
| `const [v, setV] = useState(0)`              | `readonly v = signal(0)` → đọc `v()`, ghi `v.set(1)` / `v.update(p => p + 1)` |
| `useMemo(() => …)` / biến tính từ state      | `readonly x = computed(() => …)` → đọc `x()`                                  |
| `useEffect(() => …, [])`                     | `afterNextRender(() => …)` trong `constructor`                                |
| `useEffect(() => …, [a, b])`                 | `effect(() => { this.a(); this.b(); untracked(() => …) })`                     |
| `useRef()` gắn vào thẻ (`ref={inputRef}`)    | `#inputRef` trong HTML + `viewChild('inputRef')`                              |
| `useContext(AuthContext)` / `useAuth()`      | `inject(CustomerAuthService)`                                                 |
| `useNavigate()`, `useParams()`…              | `inject(CustomerNavigationService)` → `navigate()`, `params()['id']`…        |
| `{cond && <A/>}`, `a ? <A/> : <B/>`          | `@if (cond) { … } @else { … }`                                               |
| `list.map(item => <Li key={item.id}/>)`      | `@for (item of list; track item.id) { … }`                                   |
| `const x = …` trong vòng lặp                 | `@let x = …;`                                                                 |
| `className="…"` / ``className={`…${a}`}``    | `class="…"` / ``[class]="`…${a()}`"``                                         |
| `style={{ left: 10, fontSize: 14 }}`         | `[appStyle]="{ left: 10, fontSize: 14 }"` (tự thêm px giống React)            |
| `onClick={() => setOpen(true)}`              | `(click)="open.set(true)"`                                                     |
| `onChange={(e) => setV(e.target.value)}`     | `(input)="v.set($any($event).target.value)"`                                  |
| `<Link to="/x">`, `<NavLink>`                | `<a appCustomerLink="/x">`, `#l="customerLink"` + `l.isActive()`             |
| `<ChevronDown className="h-4"/>` (lucide)    | `<app-customer-icon name="chevron-down" className="h-4" />`                   |
| `{children}`                                 | `<ng-content />`                                                              |
| prop là JSX (`title={<b>…</b>}`)             | `<ng-template #t>…</ng-template>` + `[title]="t"`                             |
| `<Outlet />`                                 | `<router-outlet />`                                                           |

### Một số quy ước riêng của bản chuyển đổi (nên biết trước khi sửa)

1. **Selector dạng thuộc tính** – phần lớn component dùng chính thẻ gốc của bản React làm thẻ host, ví dụ
   `<section app-hero-section></section>`, `<li app-footer-link …></li>`. Nhờ vậy cấu trúc HTML **giống hệt** bản React
   (không phát sinh thẻ bọc), nên các class Tailwind như `space-y-4`, `first:`, `> div`… vẫn đúng.
   Class/sự kiện của thẻ gốc nằm trong mục `host: { … }` của `@Component`.
   Component còn lại (gốc là `@if`, nhiều thẻ…) dùng thẻ `<app-…>` với `host: { style: 'display: contents' }`
   (thẻ này "vô hình" với layout).
2. **Output nhận nhiều tham số** – React gọi `onChange(name, value)`; Angular chỉ phát 1 giá trị nên phát mảng
   `[name, value]`, phía cha nhận `$any($event)[0]`, `$any($event)[1]` (có ghi chú ở đầu file).
3. **`hasOnX` input** – React kiểm tra `if (onClick)`; Angular không biết cha có lắng nghe output hay không,
   nên component cha truyền thêm `[hasOnClick]="true"`.
4. **Hàm tự sinh** `computeN()`, `handleN()`, `condN()`, `rangeN()`… – là các biểu thức/hàm xử lý sự kiện của JSX mà template
   Angular không viết trực tiếp được (arrow function, `new Date()`, `Math`...). Có thể đổi tên cho dễ đọc.
5. **`setXxxFn`** – khi React truyền hàm `setXxx` cho component con, Angular truyền `setXxxFn = reactSetter(this.xxx)`.
6. **Kiểu dữ liệu** – để chuyển nhanh và giữ nguyên logic, dữ liệu dùng kiểu `any`. Khi back-end chốt hợp đồng API,
   nên khai báo interface trong thư mục `models/` của từng chức năng và thay dần `any`.
7. **Service API trả về `Promise`** (giống axios) thay vì `Observable` để giữ nguyên các đoạn `async/await` của bản React.

## 4. Style / Tailwind

- `tailwind.config.js` (Tailwind **v3**, giống bản React) chỉ quét các thư mục `customer/` → không sinh class thừa.
- `important: '.customer-root'` → mọi utility được sinh dạng `.customer-root .flex`, chỉ có hiệu lực bên trong
  layout Customer (thẻ gốc có class `customer-root`). Nếu tạo component Customer hiển thị ngoài layout này
  (vd. dùng CDK Overlay gắn vào `body`), hãy thêm class `customer-root` cho phần tử gốc của nó.
- `preflight` (reset CSS) của Tailwind bị **tắt toàn cục** và được viết lại trong `customer.scss` với `:where(.customer-root)`
  nên chỉ áp dụng bên trong giao diện khách hàng.
- `customer.scss` được build thành file riêng `customer.css` (`angular.json` → `styles` → `inject: false`) và chỉ được
  `CustomerLayoutComponent` nạp khi người dùng vào trang Customer ⇒ **trang Admin không bị ảnh hưởng**.
- Các class tự viết của bản React (`btn-yellow`, `notification-popover`, `contact-page`, `medical-*`…) giữ nguyên tên.

## 5. Đăng nhập & gọi API

- `CustomerAuthService.completeLogin()` lưu phiên (localStorage nếu "Ghi nhớ", ngược lại sessionStorage) và đưa
  access token vào `AuthSessionService` của core ⇒ `authInterceptor` tự gắn `Authorization: Bearer …`.
- `AuthApiService.login()` gọi `POST /auth/login` (hợp đồng chung của dự án, giống trang Admin); nếu back-end trả 404 thì
  thử API cũ `POST /login` của bản React. Các API khác (đăng ký, OTP, giỏ hàng, đơn hàng, thú cưng...) **giữ nguyên
  đường dẫn của bản React** (back-end WEB2_BACKEND, dạng `{ EC, EM, DT }`) — cần kiểm tra lại với back-end chung
  (`docs/BACKEND-CONTRACT.md`).
- Lưu ý: `refreshTokenInterceptor` của core khi refresh token thất bại sẽ chuyển về `/admin/login`; nếu cần,
  nhóm có thể bổ sung điều kiện để khách hàng được mở popup đăng nhập thay vì vào trang Admin.

## 6. Danh sách đường dẫn (route)

| URL | Trang (component) |
| --- | --- |
| `/` | `features/customer/home/pages/home-page.component.ts` |
| `/dat-lich`, `/booking` | `booking/pages/booking/booking-page.component.ts` |
| `/cua-hang`, `/petshop` | `shop/pages/shop-page.component.ts` |
| `/san-pham`, `/products` | `products/pages/product-list/product-page.component.ts` |
| `/product-details/:productId` | `products/pages/product-details/product-details-page.component.ts` |
| `/product-details/:productId/write-review` (cần đăng nhập) | `products/pages/write-review/write-review-page.component.ts` |
| `/cart` | `cart/pages/cart-open-handler.component.ts` (mở popup giỏ hàng) |
| `/bai-viet`, `/blog`, `/…/kien-thuc` | `blog/pages/blog/blog-page.component.ts` |
| `/bai-viet/cong-dong` | `blog/pages/community/community-page.component.ts` |
| `/bai-viet/so-cuu`, `/bai-viet/so-cuu/:postId` | `blog/pages/first-aid/…`, `blog/pages/first-aid-detail/…` |
| `/bai-viet/:postId` | `blog/pages/blog-detail/blog-detail-page.component.ts` |
| `/cuu-tro`, `/rescue` | `rescue/pages/rescue-page.component.ts` |
| `/search?q=` | `search/pages/search-results-page.component.ts` |
| `/ve-chung-toi`, `/about` | `about/pages/about-page.component.ts` |
| `/lien-he`, `/contact` | `contact/pages/contact-page.component.ts` |
| `/policies/:slug`, `/policy` | `policy/pages/policy-page.component.ts` |
| `/dich-vu/grooming-spa` | `clinic-services/pages/grooming-spa/grooming-spa-page.component.ts` |
| `/dich-vu`, `/dich-vu/kham-dieu-tri` | `clinic-services/pages/medical-treatment/medical-treatment-page.component.ts` |
| `/checkout` | `checkout/pages/checkout-page.component.ts` |
| `/thong-tin-nguoi-dung` 🔒 | `profile/pages/user-profile-page.component.ts` |
| `/thu-cung-cua-toi` 🔒 (+ `/them-moi`, `/:id`, `/:id/chinh-sua`) | `pets/pages/my-pet/…`, `pet-form/…`, `pet-detail/…` |
| `/lich-su-dat-lich` 🔒 | `booking/pages/appointment-history/appointment-history-page.component.ts` |
| `/don-hang-cua-toi` 🔒 (+ `/:orderId`) | `orders/pages/my-orders-page.component.ts`, `order-details-page.component.ts` |
| mọi URL khác | `not-found/pages/not-found-page.component.ts` |

🔒 = cần đăng nhập (dùng `AccountLayoutComponent` có sidebar + `customerAuthGuard`).

## 7. Đã kiểm tra

- `npm run build` (production) thành công, không có lỗi/cảnh báo mới từ phần Customer.
- So sánh ảnh chụp màn hình bản React và bản Angular (cùng dữ liệu mẫu) ở 3 cỡ màn hình (1440px, 820px, 390px)
  cho 19 trang công khai + 8 trang tài khoản và ~40 bước thao tác (mở đăng nhập, menu, tìm kiếm gợi ý, giỏ hàng,
  thanh toán, đặt lịch, thông báo, popup bảng giá, nhận nuôi…): chiều cao trang trùng khớp, khác biệt điểm ảnh < 0.2%
  (chủ yếu do khử răng cưa chữ / ngày giờ hiện tại).
- Trang Admin không bị ảnh hưởng (không nạp CSS của Customer).

## 8. Gợi ý nâng cấp tiếp

- Thay kiểu `any` bằng interface theo hợp đồng API thật.
- Đổi tên các hàm tự sinh `computeN/handleN` thành tên có nghĩa khi sửa từng trang.
- Ảnh trong `public/assets/customer` khá nặng (~150MB, có ảnh 7–9MB): nên nén/chuyển sang WebP.
- Đồng bộ đường dẫn API của Customer với back-end chung (xem mục 5).

---

## 9. Danh sách từng file và chức năng

> Bảng dưới đây liệt kê **tất cả** file của phần Customer. "từ `src/...`" là file React gốc tương ứng để bạn đối chiếu.

### `src/app/core/customer/constants/`

| File | Chức năng |
| --- | --- |
| `dev-flags.ts` | Cờ dùng khi phát triển (TEST_AUTHENTICATED: giả lập đã đăng nhập). |
| `user-profile-data.ts` | Hồ sơ người dùng mặc định + khóa localStorage. |

### `src/app/core/customer/guards/`

| File | Chức năng |
| --- | --- |
| `customer-auth.guard.ts` | Chặn trang cần đăng nhập; chưa đăng nhập thì mở popup đăng nhập (thay ProtectedRoute.jsx). |

### `src/app/core/customer/services/`

| File | Chức năng |
| --- | --- |
| `api/auth-api.service.ts` | Gọi API (AuthApiService) — từ `src/services/authService.js`. Hàm: login, register, verifyRegisterOtp, forgotPassword, verifyForgotOtp, resetPassword, changePassword, logout. |
| `api/booking-api.service.ts` | Gọi API (BookingApiService) — từ `src/services/bookingService.js`. Hàm: getBranches, getServices, getAppointmentSlots, bookAppointment, previewAppointmentPricing, getAppointmentHistory, cancelAppointment, checkoutAppointment, createAppointmentServiceReview. |
| `api/cart-api.service.ts` | Gọi API (CartApiService) — từ `src/services/cartService.js`. Hàm: getCart, addCartItem, updateCartItem, deleteCartItem. |
| `api/contact-api.service.ts` | Gọi API (ContactApiService) — từ `src/services/contactService.js`. Hàm: submitContactMessage. |
| `api/content-api.service.ts` | Gọi API (ContentApiService) — từ `src/services/contentService.js`. Hàm: getBlogCategories, getFeaturedPost, getTrendingPosts, getPostsPage, getPostBySlug, getFirstAidCategories, getFirstAidGuidesPage, getFirstAidGuideBySlug, getPostComments, createPostComment, replyPostComment, togglePostLike. |
| `api/loyalty-api.service.ts` | Gọi API (LoyaltyApiService) — từ `src/services/loyaltyService.js`. Hàm: applyVoucher. |
| `api/notification-api.service.ts` | Gọi API (NotificationApiService) — từ `src/services/notificationService.js`. Hàm: getNotifications, markAsRead, markAllAsRead. |
| `api/order-api.service.ts` | Gọi API (OrderApiService) — từ `src/services/orderService.js`. Hàm: checkoutOrder, guestCheckoutOrder, getMyOrders, getOrderDetails, cancelOrder, repayOrder, canReviewOrderProduct. |
| `api/pet-api.service.ts` | Gọi API (PetApiService) — từ `src/services/petService.js`. Hàm: getMyPets, getPetDetails, getPetSpecies, getPetBreeds, createPet, updatePet, deletePet, getMedicalRecordsByPet, createMedicalRecord, updateMedicalRecord, deleteMedicalRecord, getHealthDiariesByPet, getRemindersByPet, createHealthDiary, updateHealthDiary, deleteHealthDiary, createReminder, completeReminder, deleteReminder. |
| `api/product-api.service.ts` | Gọi API (ProductApiService) — từ `src/services/productService.js`. Hàm: getProducts, getProductsPage, getProductCategories, getBestSellingProducts, getActiveFlashSale, getActiveFlashSaleProducts, getProductDetails, getProductReviews, getSimilarProducts, likeProductReview, createProductReview. |
| `api/rescue-api.service.ts` | Gọi API (RescueApiService) — từ `src/services/rescueService.js`. Hàm: getAdoptionPets, getRescueStations, createAdoptionRequest, getMyAdoptionRequests. |
| `api/search-api.service.ts` | Gọi API (SearchApiService) — từ `src/services/searchService.js`. Hàm: searchAll, getSearchSuggestionsApi. |
| `api/service-pricing-api.service.ts` | Gọi API (ServicePricingApiService) — từ `src/services/servicePricingService.js`. Hàm: getServicePricingMatrix. |
| `api/user-api.service.ts` | Gọi API (UserApiService) — từ `src/services/userService.js`. Hàm: getUserAddresses, getUserProfile, updateUserProfileApi, createUserAddress, updateUserAddress, deleteUserAddress. |
| `cart.service.ts` | Giỏ hàng + trạng thái các popup thanh toán (thay CartContext). |
| `customer-auth.service.ts` | Trạng thái đăng nhập khách hàng (thay AuthContext): isAuthenticated, userProfile, openAuth(), requireAuth(), completeLogin(), logout(). |
| `customer-http.service.ts` | Gọi API kiểu Promise (thay axios apiClient.js) qua ApiClientService của core; chuẩn hóa lỗi {status, message, data}. |
| `customer-navigation.service.ts` | Thay useNavigate/useLocation/useParams/useSearchParams bằng signal. |
| `customer-notification.service.ts` | Danh sách thông báo, số chưa đọc (thay NotificationContext). |
| `decision-modal.service.ts` | Popup xác nhận Xóa/Hủy/Thành công dùng chung (thay DecisionModalProvider). |

### `src/app/features/customer/about/`

| File | Chức năng |
| --- | --- |
| `data/about-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/aboutData.js`. |
| `pages/about-page.component.html` | Giao diện (template) của AboutPage. |
| `pages/about-page.component.ts` | Trang AboutPage — từ `src/pages/About/AboutPage.jsx` · selector `div[app-about-page]`. |
| `pages/about-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/About/AboutPage.jsx`). |

### `src/app/features/customer/auth/`

| File | Chức năng |
| --- | --- |
| `components/auth-background-blob.component.html` | Giao diện (template) của AuthBackgroundBlob. |
| `components/auth-background-blob.component.ts` | Component AuthBackgroundBlob — từ `src/components/auth/AuthModal.jsx` · selector `img[app-auth-background-blob]`. |
| `components/auth-modal.component.html` | Giao diện (template) của AuthModal. |
| `components/auth-modal.component.ts` | Component AuthModal — từ `src/components/auth/AuthModal.jsx` · selector `app-auth-modal`. |
| `components/auth-modal.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/auth/AuthModal.jsx`). |
| `components/divider.component.html` | Giao diện (template) của Divider. |
| `components/divider.component.ts` | Component Divider — từ `src/components/auth/AuthModal.jsx` · selector `div[app-divider]`. |
| `components/field.component.html` | Giao diện (template) của Field. |
| `components/field.component.ts` | Component Field — từ `src/components/auth/AuthModal.jsx` · selector `label[app-field]`. |
| `components/google-button.component.html` | Giao diện (template) của GoogleButton. |
| `components/google-button.component.ts` | Component GoogleButton — từ `src/components/auth/AuthModal.jsx` · selector `button[app-google-button]`. |
| `components/login-form.component.html` | Giao diện (template) của LoginForm. |
| `components/login-form.component.ts` | Component LoginForm — từ `src/components/auth/AuthModal.jsx` · selector `form[app-login-form]`. |
| `components/otp-form.component.html` | Giao diện (template) của OtpForm. |
| `components/otp-form.component.ts` | Component OtpForm — từ `src/components/auth/AuthModal.jsx` · selector `form[app-otp-form]`. |
| `components/primary-button.component.html` | Giao diện (template) của PrimaryButton. |
| `components/primary-button.component.ts` | Component PrimaryButton — từ `src/components/auth/AuthModal.jsx` · selector `button[app-primary-button]`. |
| `components/recovery-panel.component.html` | Giao diện (template) của RecoveryPanel. |
| `components/recovery-panel.component.ts` | Component RecoveryPanel — từ `src/components/auth/AuthModal.jsx` · selector `div[app-recovery-panel]`. |
| `components/register-form.component.html` | Giao diện (template) của RegisterForm. |
| `components/register-form.component.ts` | Component RegisterForm — từ `src/components/auth/AuthModal.jsx` · selector `form[app-register-form]`. |
| `components/split-side.component.html` | Giao diện (template) của SplitSide. |
| `components/split-side.component.ts` | Component SplitSide — từ `src/components/auth/AuthModal.jsx` · selector `aside[app-split-side]`. |
| `components/success-panel.component.html` | Giao diện (template) của SuccessPanel. |
| `components/success-panel.component.ts` | Component SuccessPanel — từ `src/components/auth/AuthModal.jsx` · selector `div[app-success-panel]`. |

### `src/app/features/customer/blog/`

| File | Chức năng |
| --- | --- |
| `pages/blog-detail/article.component.html` | Giao diện (template) của Article. |
| `pages/blog-detail/article.component.ts` | Component Article — từ `src/pages/Blog/BlogDetailPage.jsx` · selector `article[app-article]`. |
| `pages/blog-detail/blog-detail-page.component.html` | Giao diện (template) của BlogDetailPage. |
| `pages/blog-detail/blog-detail-page.component.ts` | Trang BlogDetailPage — từ `src/pages/Blog/BlogDetailPage.jsx` · selector `div[app-blog-detail-page]`. |
| `pages/blog-detail/blog-sidebar.component.html` | Giao diện (template) của BlogSidebar. |
| `pages/blog-detail/blog-sidebar.component.ts` | Component BlogSidebar — từ `src/pages/Blog/BlogDetailPage.jsx` · selector `aside[app-blog-sidebar]`. |
| `pages/blog-detail/related-blog-section.component.html` | Giao diện (template) của RelatedBlogSection. |
| `pages/blog-detail/related-blog-section.component.ts` | Component RelatedBlogSection — từ `src/pages/Blog/BlogDetailPage.jsx` · selector `app-related-blog-section`. |
| `pages/blog-detail/section-heading.component.html` | Giao diện (template) của SectionHeading. |
| `pages/blog-detail/section-heading.component.ts` | Component SectionHeading — từ `src/pages/Blog/BlogDetailPage.jsx` · selector `div[app-section-heading]`. |
| `pages/blog-detail/sidebar-heading.component.html` | Giao diện (template) của SidebarHeading. |
| `pages/blog-detail/sidebar-heading.component.ts` | Component SidebarHeading — từ `src/pages/Blog/BlogDetailPage.jsx` · selector `div[app-sidebar-heading]`. |
| `pages/blog/blog-page.component.html` | Giao diện (template) của BlogPage. |
| `pages/blog/blog-page.component.ts` | Trang BlogPage — từ `src/pages/Blog/BlogPage.jsx` · selector `div[app-blog-page]`. |
| `pages/blog/blog-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Blog/BlogPage.jsx`). |
| `pages/blog/featured-post.component.html` | Giao diện (template) của FeaturedPost. |
| `pages/blog/featured-post.component.ts` | Component FeaturedPost — từ `src/pages/Blog/BlogPage.jsx` · selector `app-featured-post`. |
| `pages/blog/trending-section.component.html` | Giao diện (template) của TrendingSection. |
| `pages/blog/trending-section.component.ts` | Component TrendingSection — từ `src/pages/Blog/BlogPage.jsx` · selector `section[app-trending-section]`. |
| `pages/community/actions.component.html` | Giao diện (template) của Actions. |
| `pages/community/actions.component.ts` | Component Actions — từ `src/pages/Blog/CommunityPage.jsx` · selector `div[app-actions]`. |
| `pages/community/author.component.html` | Giao diện (template) của Author. |
| `pages/community/author.component.ts` | Component Author — từ `src/pages/Blog/CommunityPage.jsx` · selector `div[app-author]`. |
| `pages/community/community-card.component.html` | Giao diện (template) của CommunityCard. |
| `pages/community/community-card.component.ts` | Component CommunityCard — từ `src/pages/Blog/CommunityPage.jsx` · selector `article[app-community-card]`. |
| `pages/community/community-page.component.html` | Giao diện (template) của CommunityPage. |
| `pages/community/community-page.component.ts` | Trang CommunityPage — từ `src/pages/Blog/CommunityPage.jsx` · selector `div[app-community-page]`. |
| `pages/community/community-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Blog/CommunityPage.jsx`). |
| `pages/community/composer.component.html` | Giao diện (template) của Composer. |
| `pages/community/composer.component.ts` | Component Composer — từ `src/pages/Blog/CommunityPage.jsx` · selector `section[app-composer]`. |
| `pages/community/post-modal.component.html` | Giao diện (template) của PostModal. |
| `pages/community/post-modal.component.ts` | Component PostModal — từ `src/pages/Blog/CommunityPage.jsx` · selector `div[app-post-modal]`. |
| `pages/community/type-badge.component.html` | Giao diện (template) của TypeBadge. |
| `pages/community/type-badge.component.ts` | Component TypeBadge — từ `src/pages/Blog/CommunityPage.jsx` · selector `app-type-badge`. |
| `pages/first-aid-detail/emergency-support.component.html` | Giao diện (template) của EmergencySupport. |
| `pages/first-aid-detail/emergency-support.component.ts` | Component EmergencySupport — từ `src/pages/Blog/FirstAidDetailPage.jsx` · selector `aside[app-emergency-support]`. |
| `pages/first-aid-detail/first-aid-detail-page.component.html` | Giao diện (template) của FirstAidDetailPage. |
| `pages/first-aid-detail/first-aid-detail-page.component.ts` | Trang FirstAidDetailPage — từ `src/pages/Blog/FirstAidDetailPage.jsx` · selector `div[app-first-aid-detail-page]`. |
| `pages/first-aid-detail/related-section.component.html` | Giao diện (template) của RelatedSection. |
| `pages/first-aid-detail/related-section.component.ts` | Component RelatedSection — từ `src/pages/Blog/FirstAidDetailPage.jsx` · selector `app-related-section`. |
| `pages/first-aid-detail/step-section.component.html` | Giao diện (template) của StepSection. |
| `pages/first-aid-detail/step-section.component.ts` | Component StepSection — từ `src/pages/Blog/FirstAidDetailPage.jsx` · selector `section[app-step-section]`. |
| `pages/first-aid-detail/video-section.component.html` | Giao diện (template) của VideoSection. |
| `pages/first-aid-detail/video-section.component.ts` | Component VideoSection — từ `src/pages/Blog/FirstAidDetailPage.jsx` · selector `section[app-video-section]`. |
| `pages/first-aid/first-aid-card.component.html` | Giao diện (template) của FirstAidCard. |
| `pages/first-aid/first-aid-card.component.ts` | Component FirstAidCard — từ `src/pages/Blog/FirstAidPage.jsx` · selector `app-first-aid-card`. |
| `pages/first-aid/first-aid-page.component.html` | Giao diện (template) của FirstAidPage. |
| `pages/first-aid/first-aid-page.component.ts` | Trang FirstAidPage — từ `src/pages/Blog/FirstAidPage.jsx` · selector `div[app-first-aid-page]`. |
| `pages/first-aid/first-aid-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Blog/FirstAidPage.jsx`). |
| `pages/first-aid/first-aid-tabs.component.html` | Giao diện (template) của FirstAidTabs. |
| `pages/first-aid/first-aid-tabs.component.ts` | Component FirstAidTabs — từ `src/pages/Blog/FirstAidPage.jsx` · selector `nav[app-first-aid-tabs]`. |
| `pages/first-aid/support-cards.component.html` | Giao diện (template) của SupportCards. |
| `pages/first-aid/support-cards.component.ts` | Component SupportCards — từ `src/pages/Blog/FirstAidPage.jsx` · selector `div[app-support-cards]`. |

### `src/app/features/customer/booking/`

| File | Chức năng |
| --- | --- |
| `components/appointment-details.component.html` | Giao diện (template) của AppointmentDetails. |
| `components/appointment-details.component.ts` | Component AppointmentDetails — từ `src/components/booking/BookingPaymentStep.jsx` · selector `app-appointment-details`. |
| `components/booking-payment-step.component.html` | Giao diện (template) của BookingPaymentStep. |
| `components/booking-payment-step.component.ts` | Component BookingPaymentStep — từ `src/components/booking/BookingPaymentStep.jsx` · selector `app-booking-payment-step`. |
| `components/booking-payment-step.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/booking/BookingPaymentStep.jsx`). |
| `components/booking-success-modal.component.html` | Giao diện (template) của BookingSuccessModal. |
| `components/booking-success-modal.component.ts` | Component BookingSuccessModal — từ `src/components/booking/BookingSuccessModal.jsx` · selector `div[app-booking-success-modal]`. |
| `components/booking-success-modal.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/booking/BookingPaymentStep.jsx`). |
| `components/card.component.html` | Giao diện (template) của Card. |
| `components/card.component.ts` | Component Card — từ `src/components/booking/BookingPaymentStep.jsx` · selector `section[app-card]`. |
| `components/detail.component.html` | Giao diện (template) của Detail. |
| `components/detail.component.ts` | Component Detail — từ `src/components/booking/BookingPaymentStep.jsx` · selector `div[app-detail]`. |
| `components/payment-panel.component.html` | Giao diện (template) của PaymentPanel. |
| `components/payment-panel.component.ts` | Component PaymentPanel — từ `src/components/booking/BookingPaymentStep.jsx` · selector `app-payment-panel`. |
| `components/price-row.component.html` | Giao diện (template) của PriceRow. |
| `components/price-row.component.ts` | Component PriceRow — từ `src/components/booking/BookingPaymentStep.jsx` · selector `div[app-price-row]`. |
| `data/booking-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/bookingData.js`. |
| `data/mock-appointments.ts` | Dữ liệu mẫu / hằng số — từ `src/data/mockAppointments.js`. |
| `pages/appointment-history/action-button.component.html` | Giao diện (template) của ActionButton. |
| `pages/appointment-history/action-button.component.ts` | Component ActionButton — từ `src/pages/Booking/AppointmentHistoryPage.jsx` · selector `button[app-action-button]`. |
| `pages/appointment-history/appointment-card.component.html` | Giao diện (template) của AppointmentCard. |
| `pages/appointment-history/appointment-card.component.ts` | Component AppointmentCard — từ `src/pages/Booking/AppointmentHistoryPage.jsx` · selector `article[app-appointment-card]`. |
| `pages/appointment-history/appointment-history-page.component.html` | Giao diện (template) của AppointmentHistoryPage. |
| `pages/appointment-history/appointment-history-page.component.ts` | Trang AppointmentHistoryPage — từ `src/pages/Booking/AppointmentHistoryPage.jsx` · selector `div[app-appointment-history-page]`. |
| `pages/appointment-history/appointment-history-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Booking/AppointmentHistoryPage.jsx`). |
| `pages/appointment-history/detail-panel.component.html` | Giao diện (template) của DetailPanel. |
| `pages/appointment-history/detail-panel.component.ts` | Component DetailPanel — từ `src/pages/Booking/AppointmentHistoryPage.jsx` · selector `aside[app-detail-panel]`. |
| `pages/appointment-history/payment-countdown.component.html` | Giao diện (template) của PaymentCountdown. |
| `pages/appointment-history/payment-countdown.component.ts` | Component PaymentCountdown — từ `src/pages/Booking/AppointmentHistoryPage.jsx` · selector `span[app-payment-countdown]`. |
| `pages/appointment-history/review-modal.component.html` | Giao diện (template) của ReviewModal. |
| `pages/appointment-history/review-modal.component.ts` | Component ReviewModal — từ `src/pages/Booking/AppointmentHistoryPage.jsx` · selector `div[app-review-modal]`. |
| `pages/appointment-history/search-and-sort.component.html` | Giao diện (template) của SearchAndSort. |
| `pages/appointment-history/search-and-sort.component.ts` | Component SearchAndSort — từ `src/pages/Booking/AppointmentHistoryPage.jsx` · selector `form[app-search-and-sort]`. |
| `pages/appointment-history/small-icon.component.html` | Giao diện (template) của SmallIcon. |
| `pages/appointment-history/small-icon.component.ts` | Component SmallIcon — từ `src/pages/Booking/AppointmentHistoryPage.jsx` · selector `img[app-small-icon]`. |
| `pages/appointment-history/timeline.component.html` | Giao diện (template) của Timeline. |
| `pages/appointment-history/timeline.component.ts` | Component Timeline — từ `src/pages/Booking/AppointmentHistoryPage.jsx` · selector `div[app-timeline]`. |
| `pages/booking/asset-icon.component.html` | Giao diện (template) của AssetIcon. |
| `pages/booking/asset-icon.component.ts` | Component AssetIcon — từ `src/pages/Booking/BookingPage.jsx` · selector `img[app-asset-icon]`. |
| `pages/booking/booking-calendar.component.html` | Giao diện (template) của BookingCalendar. |
| `pages/booking/booking-calendar.component.ts` | Component BookingCalendar — từ `src/pages/Booking/BookingPage.jsx` · selector `app-booking-calendar`. |
| `pages/booking/booking-card.component.html` | Giao diện (template) của BookingCard. |
| `pages/booking/booking-card.component.ts` | Component BookingCard — từ `src/pages/Booking/BookingPage.jsx` · selector `app-booking-card`. |
| `pages/booking/booking-field.component.html` | Giao diện (template) của BookingField. |
| `pages/booking/booking-field.component.ts` | Component BookingField — từ `src/pages/Booking/BookingPage.jsx` · selector `label[app-booking-field]`. |
| `pages/booking/booking-page.component.html` | Giao diện (template) của BookingPage. |
| `pages/booking/booking-page.component.ts` | Trang BookingPage — từ `src/pages/Booking/BookingPage.jsx` · selector `div[app-booking-page]`. |
| `pages/booking/booking-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Booking/BookingPage.jsx`). |
| `pages/booking/branch-selection-card.component.html` | Giao diện (template) của BranchSelectionCard. |
| `pages/booking/branch-selection-card.component.ts` | Component BranchSelectionCard — từ `src/pages/Booking/BookingPage.jsx` · selector `app-branch-selection-card`. |
| `pages/booking/flow-buttons.component.html` | Giao diện (template) của FlowButtons. |
| `pages/booking/flow-buttons.component.ts` | Component FlowButtons — từ `src/pages/Booking/BookingPage.jsx` · selector `div[app-flow-buttons]`. |
| `pages/booking/info-form.component.html` | Giao diện (template) của InfoForm. |
| `pages/booking/info-form.component.ts` | Component InfoForm — từ `src/pages/Booking/BookingPage.jsx` · selector `app-info-form`. |
| `pages/booking/pet-info-card.component.html` | Giao diện (template) của PetInfoCard. |
| `pages/booking/pet-info-card.component.ts` | Component PetInfoCard — từ `src/pages/Booking/BookingPage.jsx` · selector `app-pet-info-card`. |
| `pages/booking/pet-selection-modal.component.html` | Giao diện (template) của PetSelectionModal. |
| `pages/booking/pet-selection-modal.component.ts` | Component PetSelectionModal — từ `src/pages/Booking/BookingPage.jsx` · selector `div[app-pet-selection-modal]`. |
| `pages/booking/pet-summary-card.component.html` | Giao diện (template) của PetSummaryCard. |
| `pages/booking/pet-summary-card.component.ts` | Component PetSummaryCard — từ `src/pages/Booking/BookingPage.jsx` · selector `button[app-pet-summary-card]`. |
| `pages/booking/service-selection.component.html` | Giao diện (template) của ServiceSelection. |
| `pages/booking/service-selection.component.ts` | Component ServiceSelection — từ `src/pages/Booking/BookingPage.jsx` · selector `app-service-selection`. |
| `pages/booking/stepper.component.html` | Giao diện (template) của Stepper. |
| `pages/booking/stepper.component.ts` | Component Stepper — từ `src/pages/Booking/BookingPage.jsx` · selector `div[app-stepper]`. |
| `pages/booking/time-slots.component.html` | Giao diện (template) của TimeSlots. |
| `pages/booking/time-slots.component.ts` | Component TimeSlots — từ `src/pages/Booking/BookingPage.jsx` · selector `app-time-slots`. |
| `utils/appointment-display.ts` | Hàm tiện ích — từ `src/utils/appointmentDisplay.js`. |

### `src/app/features/customer/cart/`

| File | Chức năng |
| --- | --- |
| `components/cart-drawer.component.html` | Giao diện (template) của CartDrawer. |
| `components/cart-drawer.component.ts` | Component CartDrawer — từ `src/components/cart/CartDrawer.jsx` · selector `app-cart-drawer`. |
| `components/cart-item-row.component.html` | Giao diện (template) của CartItemRow. |
| `components/cart-item-row.component.ts` | Component CartItemRow — từ `src/components/cart/MyCartPanel.jsx` · selector `div[app-cart-item-row]`. |
| `components/my-cart-panel.component.html` | Giao diện (template) của MyCartPanel. |
| `components/my-cart-panel.component.ts` | Component MyCartPanel — từ `src/components/cart/MyCartPanel.jsx` · selector `aside[app-my-cart-panel]`. |
| `components/my-cart-panel.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/cart/CartDrawer.jsx`). |
| `pages/cart-open-handler.component.ts` | Route /cart: mở giỏ hàng rồi quay lại trang trước. |

### `src/app/features/customer/checkout/`

| File | Chức năng |
| --- | --- |
| `assets/bank-transfer-assets.ts` | Đường dẫn ảnh — từ `src/components/checkout/bankTransferAssets.js`. |
| `assets/checkout-assets.ts` | Đường dẫn ảnh — từ `src/components/checkout/checkoutAssets.js`. |
| `assets/guest-success-assets.ts` | Đường dẫn ảnh — từ `src/components/checkout/guestSuccessAssets.js`. |
| `assets/order-success-assets.ts` | Đường dẫn ảnh — từ `src/components/checkout/orderSuccessAssets.js`. |
| `components/address-change-modal.component.html` | Giao diện (template) của AddressChangeModal. |
| `components/address-change-modal.component.ts` | Component AddressChangeModal — từ `src/components/checkout/ShoppingCheckout.jsx` · selector `app-address-change-modal`. |
| `components/address-list.component.html` | Giao diện (template) của AddressList. |
| `components/address-list.component.ts` | Component AddressList — từ `src/components/checkout/ShoppingCheckout.jsx` · selector `app-address-list`. |
| `components/appointment-checkout.component.html` | Giao diện (template) của AppointmentCheckout. |
| `components/appointment-checkout.component.ts` | Component AppointmentCheckout — từ `src/components/checkout/AppointmentCheckout.jsx` · selector `div[app-appointment-checkout]`. |
| `components/authenticated-address-card.component.html` | Giao diện (template) của AuthenticatedAddressCard. |
| `components/authenticated-address-card.component.ts` | Component AuthenticatedAddressCard — từ `src/components/checkout/ShoppingCheckout.jsx` · selector `section[app-authenticated-address-card]`. |
| `components/bank-transfer-modal.component.html` | Giao diện (template) của BankTransferModal. |
| `components/bank-transfer-modal.component.ts` | Component BankTransferModal — từ `src/components/checkout/BankTransferModal.jsx` · selector `app-bank-transfer-modal`. |
| `components/checkout-order-item.component.html` | Giao diện (template) của CheckoutOrderItem. |
| `components/checkout-order-item.component.ts` | Component CheckoutOrderItem — từ `src/components/checkout/ShoppingCheckout.jsx` · selector `div[app-checkout-order-item]`. |
| `components/checkout-overlay.component.html` | Giao diện (template) của CheckoutOverlay. |
| `components/checkout-overlay.component.ts` | Component CheckoutOverlay — từ `src/components/checkout/CheckoutOverlay.jsx` · selector `app-checkout-overlay`. |
| `components/checkout.component.html` | Giao diện (template) của Checkout. |
| `components/checkout.component.ts` | Component Checkout — từ `src/components/checkout/Checkout.jsx` · selector `app-checkout`. |
| `components/coupon-and-summary.component.html` | Giao diện (template) của CouponAndSummary. |
| `components/coupon-and-summary.component.ts` | Component CouponAndSummary — từ `src/components/checkout/ShoppingCheckout.jsx` · selector `app-coupon-and-summary`. |
| `components/field-label.component.html` | Giao diện (template) của FieldLabel. |
| `components/field-label.component.ts` | Component FieldLabel — từ `src/components/checkout/GuestCheckoutSections.jsx` · selector `label[app-field-label]`. |
| `components/guest-login-banner.component.html` | Giao diện (template) của GuestLoginBanner. |
| `components/guest-login-banner.component.ts` | Component GuestLoginBanner — từ `src/components/checkout/GuestCheckoutSections.jsx` · selector `section[app-guest-login-banner]`. |
| `components/guest-order-success-overlay.component.html` | Giao diện (template) của GuestOrderSuccessOverlay. |
| `components/guest-order-success-overlay.component.ts` | Component GuestOrderSuccessOverlay — từ `src/components/checkout/GuestOrderSuccessOverlay.jsx` · selector `app-guest-order-success-overlay`. |
| `components/guest-shipping-form.component.html` | Giao diện (template) của GuestShippingForm. |
| `components/guest-shipping-form.component.ts` | Component GuestShippingForm — từ `src/components/checkout/GuestCheckoutSections.jsx` · selector `section[app-guest-shipping-form]`. |
| `components/online-payment-methods.component.html` | Giao diện (template) của OnlinePaymentMethods. |
| `components/online-payment-methods.component.ts` | Component OnlinePaymentMethods — từ `src/components/checkout/ShoppingCheckout.jsx` · selector `div[app-online-payment-methods]`. |
| `components/order-details-card.component.html` | Giao diện (template) của OrderDetailsCard. |
| `components/order-details-card.component.ts` | Component OrderDetailsCard — từ `src/components/checkout/ShoppingCheckout.jsx` · selector `section[app-order-details-card]`. |
| `components/order-success-overlay.component.html` | Giao diện (template) của OrderSuccessOverlay. |
| `components/order-success-overlay.component.ts` | Component OrderSuccessOverlay — từ `src/components/checkout/OrderSuccessOverlay.jsx` · selector `app-order-success-overlay`. |
| `components/payment-mode-toggle.component.html` | Giao diện (template) của PaymentModeToggle. |
| `components/payment-mode-toggle.component.ts` | Component PaymentModeToggle — từ `src/components/checkout/ShoppingCheckout.jsx` · selector `div[app-payment-mode-toggle]`. |
| `components/pill-input.component.html` | Giao diện (template) của PillInput. |
| `components/pill-input.component.ts` | Component PillInput — từ `src/components/checkout/GuestCheckoutSections.jsx` · selector `app-pill-input`. |
| `components/shopping-checkout.component.html` | Giao diện (template) của ShoppingCheckout. |
| `components/shopping-checkout.component.ts` | Component ShoppingCheckout — từ `src/components/checkout/ShoppingCheckout.jsx` · selector `div[app-shopping-checkout]`. |
| `components/shopping-checkout.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/checkout/AppointmentCheckout.jsx`). |
| `pages/checkout-page.component.html` | Giao diện (template) của CheckoutPage. |
| `pages/checkout-page.component.ts` | Trang CheckoutPage — từ `src/pages/Checkout/CheckoutPage.jsx` · selector `div[app-checkout-page]`. |

### `src/app/features/customer/clinic-services/`

| File | Chức năng |
| --- | --- |
| `components/grooming/book-button.component.html` | Giao diện (template) của BookButton. |
| `components/grooming/book-button.component.ts` | Component BookButton — từ `src/components/groomingSpa/GroomingCombos.jsx` · selector `app-book-button`. |
| `components/grooming/grooming-banner.component.html` | Giao diện (template) của GroomingBanner. |
| `components/grooming/grooming-banner.component.ts` | Component GroomingBanner — từ `src/components/groomingSpa/GroomingBanner.jsx` · selector `section[app-grooming-banner]`. |
| `components/grooming/grooming-combos.component.html` | Giao diện (template) của GroomingCombos. |
| `components/grooming/grooming-combos.component.ts` | Component GroomingCombos — từ `src/components/groomingSpa/GroomingCombos.jsx` · selector `section[app-grooming-combos]`. |
| `components/grooming/grooming-faq.component.html` | Giao diện (template) của GroomingFAQ. |
| `components/grooming/grooming-faq.component.ts` | Component GroomingFAQ — từ `src/components/groomingSpa/GroomingFAQ.jsx` · selector `app-grooming-faq`. |
| `components/grooming/grooming-feedback-section-feedback-card.component.html` | Giao diện (template) của GroomingFeedbackSectionFeedbackCard. |
| `components/grooming/grooming-feedback-section-feedback-card.component.ts` | Component GroomingFeedbackSectionFeedbackCard — từ `src/components/groomingSpa/GroomingFeedbackSection.jsx` · selector `article[app-grooming-feedback-section-feedback-card]`. |
| `components/grooming/grooming-feedback-section-feedback-dot.component.html` | Giao diện (template) của GroomingFeedbackSectionFeedbackDot. |
| `components/grooming/grooming-feedback-section-feedback-dot.component.ts` | Component GroomingFeedbackSectionFeedbackDot — từ `src/components/groomingSpa/GroomingFeedbackSection.jsx` · selector `button[app-grooming-feedback-section-feedback-dot]`. |
| `components/grooming/grooming-feedback-section.component.html` | Giao diện (template) của GroomingFeedbackSection. |
| `components/grooming/grooming-feedback-section.component.ts` | Component GroomingFeedbackSection — từ `src/components/groomingSpa/GroomingFeedbackSection.jsx` · selector `section[app-grooming-feedback-section]`. |
| `components/grooming/grooming-feedback-section.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/groomingSpa/GroomingBanner.jsx`). |
| `components/grooming/grooming-feedback.component.html` | Giao diện (template) của GroomingFeedback. |
| `components/grooming/grooming-feedback.component.ts` | Component GroomingFeedback — từ `src/components/groomingSpa/GroomingFeedback.jsx` · selector `section[app-grooming-feedback]`. |
| `components/grooming/grooming-hero.component.html` | Giao diện (template) của GroomingHero. |
| `components/grooming/grooming-hero.component.ts` | Component GroomingHero — từ `src/components/groomingSpa/GroomingHero.jsx` · selector `section[app-grooming-hero]`. |
| `components/grooming/grooming-services.component.html` | Giao diện (template) của GroomingServices. |
| `components/grooming/grooming-services.component.ts` | Component GroomingServices — từ `src/components/groomingSpa/GroomingServices.jsx` · selector `app-grooming-services`. |
| `components/grooming/grooming-services.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/groomingSpa/GroomingBanner.jsx`). |
| `components/grooming/grooming-why-us.component.html` | Giao diện (template) của GroomingWhyUs. |
| `components/grooming/grooming-why-us.component.ts` | Component GroomingWhyUs — từ `src/components/groomingSpa/GroomingWhyUs.jsx` · selector `app-grooming-why-us`. |
| `components/grooming/masked-blue-panel.component.html` | Giao diện (template) của MaskedBluePanel. |
| `components/grooming/masked-blue-panel.component.ts` | Component MaskedBluePanel — từ `src/components/groomingSpa/GroomingCombos.jsx` · selector `app-masked-blue-panel`. |
| `components/grooming/review-card.component.html` | Giao diện (template) của ReviewCard. |
| `components/grooming/review-card.component.ts` | Component ReviewCard — từ `src/components/groomingSpa/GroomingFeedback.jsx` · selector `article[app-review-card]`. |
| `components/grooming/service-card.component.html` | Giao diện (template) của ServiceCard. |
| `components/grooming/service-card.component.ts` | Component ServiceCard — từ `src/components/groomingSpa/GroomingServices.jsx` · selector `div[app-service-card]`. |
| `components/grooming/small-combo-card.component.html` | Giao diện (template) của SmallComboCard. |
| `components/grooming/small-combo-card.component.ts` | Component SmallComboCard — từ `src/components/groomingSpa/GroomingCombos.jsx` · selector `article[app-small-combo-card]`. |
| `components/grooming/value-prop-card.component.html` | Giao diện (template) của ValuePropCard. |
| `components/grooming/value-prop-card.component.ts` | Component ValuePropCard — từ `src/components/groomingSpa/GroomingWhyUs.jsx` · selector `app-value-prop-card`. |
| `components/service-pricing-modal/price-cell-group.component.html` | Giao diện (template) của PriceCellGroup. |
| `components/service-pricing-modal/price-cell-group.component.ts` | Component PriceCellGroup — từ `src/components/groomingSpa/ServicePricingModal.jsx` · selector `div[app-price-cell-group]`. |
| `components/service-pricing-modal/price-pill.component.html` | Giao diện (template) của PricePill. |
| `components/service-pricing-modal/price-pill.component.ts` | Component PricePill — từ `src/components/groomingSpa/ServicePricingModal.jsx` · selector `div[app-price-pill]`. |
| `components/service-pricing-modal/service-icon.component.html` | Giao diện (template) của ServiceIcon. |
| `components/service-pricing-modal/service-icon.component.ts` | Component ServiceIcon — từ `src/components/groomingSpa/ServicePricingModal.jsx` · selector `app-service-icon`. |
| `components/service-pricing-modal/service-pricing-modal.component.html` | Giao diện (template) của ServicePricingModal. |
| `components/service-pricing-modal/service-pricing-modal.component.ts` | Component ServicePricingModal — từ `src/components/groomingSpa/ServicePricingModal.jsx` · selector `app-service-pricing-modal`. |
| `components/service-pricing-modal/service-pricing-modal.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/groomingSpa/ServicePricingModal.jsx`). |
| `data/medical-treatment-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/medicalTreatmentData.js`. |
| `pages/grooming-spa/grooming-canvas.component.html` | Giao diện (template) của GroomingCanvas. |
| `pages/grooming-spa/grooming-canvas.component.ts` | Component GroomingCanvas — từ `src/pages/Services/GroomingSpaPage.jsx` · selector `app-grooming-canvas`. |
| `pages/grooming-spa/grooming-spa-page.component.html` | Giao diện (template) của GroomingSpaPage. |
| `pages/grooming-spa/grooming-spa-page.component.ts` | Trang GroomingSpaPage — từ `src/pages/Services/GroomingSpaPage.jsx` · selector `div[app-grooming-spa-page]`. |
| `pages/medical-treatment/medical-canvas.component.html` | Giao diện (template) của MedicalCanvas. |
| `pages/medical-treatment/medical-canvas.component.ts` | Component MedicalCanvas — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `app-medical-canvas`. |
| `pages/medical-treatment/medical-cta.component.html` | Giao diện (template) của MedicalCta. |
| `pages/medical-treatment/medical-cta.component.ts` | Component MedicalCta — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `section[app-medical-cta]`. |
| `pages/medical-treatment/medical-doctors.component.html` | Giao diện (template) của MedicalDoctors. |
| `pages/medical-treatment/medical-doctors.component.ts` | Component MedicalDoctors — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `section[app-medical-doctors]`. |
| `pages/medical-treatment/medical-faq.component.html` | Giao diện (template) của MedicalFaq. |
| `pages/medical-treatment/medical-faq.component.ts` | Component MedicalFaq — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `app-medical-faq`. |
| `pages/medical-treatment/medical-hero.component.html` | Giao diện (template) của MedicalHero. |
| `pages/medical-treatment/medical-hero.component.ts` | Component MedicalHero — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `section[app-medical-hero]`. |
| `pages/medical-treatment/medical-services.component.html` | Giao diện (template) của MedicalServices. |
| `pages/medical-treatment/medical-services.component.ts` | Component MedicalServices — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `section[app-medical-services]`. |
| `pages/medical-treatment/medical-stats.component.html` | Giao diện (template) của MedicalStats. |
| `pages/medical-treatment/medical-stats.component.ts` | Component MedicalStats — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `section[app-medical-stats]`. |
| `pages/medical-treatment/medical-treatment-page.component.html` | Giao diện (template) của MedicalTreatmentPage. |
| `pages/medical-treatment/medical-treatment-page.component.ts` | Trang MedicalTreatmentPage — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `div[app-medical-treatment-page]`. |
| `pages/medical-treatment/medical-treatment-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Services/MedicalTreatmentPage.jsx`). |
| `pages/medical-treatment/medical-why.component.html` | Giao diện (template) của MedicalWhy. |
| `pages/medical-treatment/medical-why.component.ts` | Component MedicalWhy — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `section[app-medical-why]`. |
| `pages/medical-treatment/why-item.component.html` | Giao diện (template) của WhyItem. |
| `pages/medical-treatment/why-item.component.ts` | Component WhyItem — từ `src/pages/Services/MedicalTreatmentPage.jsx` · selector `article[app-why-item]`. |
| `utils/grooming-mask.utils.ts` | Hàm tiện ích — từ `src/components/groomingSpa/groomingMaskUtils.js`. |
| `utils/grooming-title-styles.ts` | Hàm tiện ích — từ `src/components/groomingSpa/groomingTitleStyles.js`. |

### `src/app/features/customer/contact/`

| File | Chức năng |
| --- | --- |
| `data/contact-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/contactData.js`. |
| `pages/branch-card.component.html` | Giao diện (template) của BranchCard. |
| `pages/branch-card.component.ts` | Component BranchCard — từ `src/pages/Contact/ContactPage.jsx` · selector `button[app-branch-card]`. |
| `pages/branch-directory.component.html` | Giao diện (template) của BranchDirectory. |
| `pages/branch-directory.component.ts` | Component BranchDirectory — từ `src/pages/Contact/ContactPage.jsx` · selector `section[app-branch-directory]`. |
| `pages/contact-channel.component.html` | Giao diện (template) của ContactChannel. |
| `pages/contact-channel.component.ts` | Component ContactChannel — từ `src/pages/Contact/ContactPage.jsx` · selector `a[app-contact-channel]`. |
| `pages/contact-form.component.html` | Giao diện (template) của ContactForm. |
| `pages/contact-form.component.ts` | Component ContactForm — từ `src/pages/Contact/ContactPage.jsx` · selector `form[app-contact-form]`. |
| `pages/contact-page.component.html` | Giao diện (template) của ContactPage. |
| `pages/contact-page.component.ts` | Trang ContactPage — từ `src/pages/Contact/ContactPage.jsx` · selector `div[app-contact-page]`. |
| `pages/contact-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Contact/ContactPage.jsx`). |

### `src/app/features/customer/`

| File | Chức năng |
| --- | --- |
| `customer.routes.ts` | Toàn bộ route của Customer (thay routes/AppRoutes.jsx). |

### `src/app/features/customer/home/`

| File | Chức năng |
| --- | --- |
| `components/about-section.component.html` | Giao diện (template) của AboutSection. |
| `components/about-section.component.ts` | Component AboutSection — từ `src/components/home/AboutSection.jsx` · selector `section[app-about-section]`. |
| `components/blog-post-item.component.html` | Giao diện (template) của BlogPostItem. |
| `components/blog-post-item.component.ts` | Component BlogPostItem — từ `src/components/home/BlogSection.jsx` · selector `app-blog-post-item`. |
| `components/blog-section.component.html` | Giao diện (template) của BlogSection. |
| `components/blog-section.component.ts` | Component BlogSection — từ `src/components/home/BlogSection.jsx` · selector `section[app-blog-section]`. |
| `components/check-icon.component.html` | Giao diện (template) của CheckIcon. |
| `components/check-icon.component.ts` | Component CheckIcon — từ `src/components/home/AboutSection.jsx` · selector `span[app-check-icon]`. |
| `components/doctor-card.component.html` | Giao diện (template) của DoctorCard. |
| `components/doctor-card.component.ts` | Component DoctorCard — từ `src/components/home/DoctorSection.jsx` · selector `article[app-doctor-card]`. |
| `components/doctor-section.component.html` | Giao diện (template) của DoctorSection. |
| `components/doctor-section.component.ts` | Component DoctorSection — từ `src/components/home/DoctorSection.jsx` · selector `section[app-doctor-section]`. |
| `components/hero-section.component.html` | Giao diện (template) của HeroSection. |
| `components/hero-section.component.ts` | Component HeroSection — từ `src/components/home/HeroSection.jsx` · selector `section[app-hero-section]`. |
| `components/product-section.component.html` | Giao diện (template) của ProductSection. |
| `components/product-section.component.ts` | Component ProductSection — từ `src/components/home/ProductSection.jsx` · selector `app-product-section`. |
| `components/service-section-service-card.component.html` | Giao diện (template) của ServiceSectionServiceCard. |
| `components/service-section-service-card.component.ts` | Component ServiceSectionServiceCard — từ `src/components/home/ServiceSection.jsx` · selector `article[app-service-section-service-card]`. |
| `components/service-section.component.html` | Giao diện (template) của ServiceSection. |
| `components/service-section.component.ts` | Component ServiceSection — từ `src/components/home/ServiceSection.jsx` · selector `section[app-service-section]`. |
| `data/home-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/homeData.js`. |
| `pages/home-page.component.html` | Giao diện (template) của HomePage. |
| `pages/home-page.component.ts` | Trang HomePage — từ `src/pages/HomePage/HomePage.jsx` · selector `div[app-home-page]`. |

### `src/app/features/customer/not-found/`

| File | Chức năng |
| --- | --- |
| `pages/not-found-page.component.html` | Giao diện (template) của NotFoundPage. |
| `pages/not-found-page.component.ts` | Trang NotFoundPage — từ `src/pages/Error/NotFoundPage.jsx` · selector `div[app-not-found-page]`. |
| `pages/not-found-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Error/NotFoundPage.jsx`). |

### `src/app/features/customer/orders/`

| File | Chức năng |
| --- | --- |
| `data/order-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/orderData.js`. |
| `pages/invoice-modal.component.html` | Giao diện (template) của InvoiceModal. |
| `pages/invoice-modal.component.ts` | Component InvoiceModal — từ `src/pages/Order/OrderPages.jsx` · selector `div[app-invoice-modal]`. |
| `pages/my-orders-page.component.html` | Giao diện (template) của MyOrdersPage. |
| `pages/my-orders-page.component.ts` | Trang MyOrdersPage — từ `src/pages/Order/OrderPages.jsx` · selector `div[app-my-orders-page]`. |
| `pages/order-actions.component.html` | Giao diện (template) của OrderActions. |
| `pages/order-actions.component.ts` | Component OrderActions — từ `src/pages/Order/OrderPages.jsx` · selector `app-order-actions`. |
| `pages/order-card.component.html` | Giao diện (template) của OrderCard. |
| `pages/order-card.component.ts` | Component OrderCard — từ `src/pages/Order/OrderPages.jsx` · selector `article[app-order-card]`. |
| `pages/order-details-page.component.html` | Giao diện (template) của OrderDetailsPage. |
| `pages/order-details-page.component.ts` | Trang OrderDetailsPage — từ `src/pages/Order/OrderPages.jsx` · selector `app-order-details-page`. |
| `pages/order-pages-payment-countdown.component.html` | Giao diện (template) của OrderPagesPaymentCountdown. |
| `pages/order-pages-payment-countdown.component.ts` | Component OrderPagesPaymentCountdown — từ `src/pages/Order/OrderPages.jsx` · selector `span[app-order-pages-payment-countdown]`. |
| `pages/order-pages-search-and-sort.component.html` | Giao diện (template) của OrderPagesSearchAndSort. |
| `pages/order-pages-search-and-sort.component.ts` | Component OrderPagesSearchAndSort — từ `src/pages/Order/OrderPages.jsx` · selector `form[app-order-pages-search-and-sort]`. |
| `pages/order-pages-yellow-button.component.html` | Giao diện (template) của OrderPagesYellowButton. |
| `pages/order-pages-yellow-button.component.ts` | Component OrderPagesYellowButton — từ `src/pages/Order/OrderPages.jsx` · selector `app-order-pages-yellow-button`. |
| `pages/order-pages-yellow-button.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Order/OrderPages.jsx`). |
| `pages/order-review-modal.component.html` | Giao diện (template) của OrderReviewModal. |
| `pages/order-review-modal.component.ts` | Component OrderReviewModal — từ `src/pages/Order/OrderPages.jsx` · selector `div[app-order-review-modal]`. |
| `pages/outline-button.component.html` | Giao diện (template) của OutlineButton. |
| `pages/outline-button.component.ts` | Component OutlineButton — từ `src/pages/Order/OrderPages.jsx` · selector `app-outline-button`. |
| `pages/product-summary.component.html` | Giao diện (template) của ProductSummary. |
| `pages/product-summary.component.ts` | Component ProductSummary — từ `src/pages/Order/OrderPages.jsx` · selector `div[app-product-summary]`. |

### `src/app/features/customer/pets/`

| File | Chức năng |
| --- | --- |
| `data/mock-pets.ts` | Dữ liệu mẫu / hằng số — từ `src/data/mockPets.js`. |
| `data/pet-events.ts` | Dữ liệu mẫu / hằng số — từ `src/data/petEvents.js`. |
| `pages/my-pet/gender-icon.component.html` | Giao diện (template) của GenderIcon. |
| `pages/my-pet/gender-icon.component.ts` | Component GenderIcon — từ `src/pages/Pet/MyPetPage.jsx` · selector `app-gender-icon`. |
| `pages/my-pet/my-pet-search-and-sort.component.html` | Giao diện (template) của MyPetSearchAndSort. |
| `pages/my-pet/my-pet-search-and-sort.component.ts` | Component MyPetSearchAndSort — từ `src/pages/Pet/MyPetPage.jsx` · selector `form[app-my-pet-search-and-sort]`. |
| `pages/my-pet/pet-list-page.component.html` | Giao diện (template) của PetListPage. |
| `pages/my-pet/pet-list-page.component.ts` | Trang PetListPage — từ `src/pages/Pet/MyPetPage.jsx` · selector `div[app-pet-list-page]`. |
| `pages/my-pet/pet-list-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Pet/MyPetPage.jsx`). |
| `pages/my-pet/species-icon.component.html` | Giao diện (template) của SpeciesIcon. |
| `pages/my-pet/species-icon.component.ts` | Component SpeciesIcon — từ `src/pages/Pet/MyPetPage.jsx` · selector `app-species-icon`. |
| `pages/pet-detail/pet-detail-page.component.html` | Giao diện (template) của PetDetailPage. |
| `pages/pet-detail/pet-detail-page.component.ts` | Trang PetDetailPage — từ `src/pages/Pet/PetDetailPage.jsx` · selector `div[app-pet-detail-page]`. |
| `pages/pet-detail/pet-detail-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Pet/PetDetailPage.jsx`). |
| `pages/pet-form/medical-record-card.component.html` | Giao diện (template) của MedicalRecordCard. |
| `pages/pet-form/medical-record-card.component.ts` | Component MedicalRecordCard — từ `src/pages/Pet/PetFormPage.jsx` · selector `div[app-medical-record-card]`. |
| `pages/pet-form/pet-form-page.component.html` | Giao diện (template) của PetFormPage. |
| `pages/pet-form/pet-form-page.component.ts` | Trang PetFormPage — từ `src/pages/Pet/PetFormPage.jsx` · selector `div[app-pet-form-page]`. |
| `pages/pet-form/pet-form-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Pet/PetFormPage.jsx`). |

### `src/app/features/customer/policy/`

| File | Chức năng |
| --- | --- |
| `data/policy-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/policyData.js`. |
| `pages/policy-article.component.html` | Giao diện (template) của PolicyArticle. |
| `pages/policy-article.component.ts` | Component PolicyArticle — từ `src/pages/Policy/PolicyPage.jsx` · selector `article[app-policy-article]`. |
| `pages/policy-page.component.html` | Giao diện (template) của PolicyPage. |
| `pages/policy-page.component.ts` | Trang PolicyPage — từ `src/pages/Policy/PolicyPage.jsx` · selector `div[app-policy-page]`. |
| `pages/policy-related-sidebar.component.html` | Giao diện (template) của PolicyRelatedSidebar. |
| `pages/policy-related-sidebar.component.ts` | Component PolicyRelatedSidebar — từ `src/pages/Policy/PolicyPage.jsx` · selector `aside[app-policy-related-sidebar]`. |
| `pages/policy-section.component.html` | Giao diện (template) của PolicySection. |
| `pages/policy-section.component.ts` | Component PolicySection — từ `src/pages/Policy/PolicyPage.jsx` · selector `section[app-policy-section]`. |
| `pages/policy-support-cta.component.html` | Giao diện (template) của PolicySupportCta. |
| `pages/policy-support-cta.component.ts` | Component PolicySupportCta — từ `src/pages/Policy/PolicyPage.jsx` · selector `section[app-policy-support-cta]`. |
| `pages/rich-text.component.html` | Giao diện (template) của RichText. |
| `pages/rich-text.component.ts` | Component RichText — từ `src/pages/Policy/PolicyPage.jsx` · selector `p[app-rich-text]`. |

### `src/app/features/customer/products/`

| File | Chức năng |
| --- | --- |
| `components/star-rating.component.html` | Giao diện (template) của StarRating. |
| `components/star-rating.component.ts` | Component StarRating — từ `src/components/product/WriteReviewForm.jsx` · selector `div[app-star-rating]`. |
| `components/write-review-form.component.html` | Giao diện (template) của WriteReviewForm. |
| `components/write-review-form.component.ts` | Component WriteReviewForm — từ `src/components/product/WriteReviewForm.jsx` · selector `form[app-write-review-form]`. |
| `pages/product-details/product-details-page.component.html` | Giao diện (template) của ProductDetailsPage. |
| `pages/product-details/product-details-page.component.ts` | Trang ProductDetailsPage — từ `src/pages/Product/ProductDetailsPage.jsx` · selector `app-product-details-page`. |
| `pages/product-details/product-details-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Product/ProductDetailsPage.jsx`). |
| `pages/product-list/filter-heading.component.html` | Giao diện (template) của FilterHeading. |
| `pages/product-list/filter-heading.component.ts` | Component FilterHeading — từ `src/pages/Product/ProductPage.jsx` · selector `div[app-filter-heading]`. |
| `pages/product-list/filter-sidebar.component.html` | Giao diện (template) của FilterSidebar. |
| `pages/product-list/filter-sidebar.component.ts` | Component FilterSidebar — từ `src/pages/Product/ProductPage.jsx` · selector `aside[app-filter-sidebar]`. |
| `pages/product-list/load-more.component.html` | Giao diện (template) của LoadMore. |
| `pages/product-list/load-more.component.ts` | Component LoadMore — từ `src/pages/Product/ProductPage.jsx` · selector `div[app-load-more]`. |
| `pages/product-list/product-grid.component.html` | Giao diện (template) của ProductGrid. |
| `pages/product-list/product-grid.component.ts` | Component ProductGrid — từ `src/pages/Product/ProductPage.jsx` · selector `app-product-grid`. |
| `pages/product-list/product-page.component.html` | Giao diện (template) của ProductPage. |
| `pages/product-list/product-page.component.ts` | Trang ProductPage — từ `src/pages/Product/ProductPage.jsx` · selector `div[app-product-page]`. |
| `pages/product-list/product-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Product/ProductPage.jsx`). |
| `pages/product-list/product-search-and-sort.component.html` | Giao diện (template) của ProductSearchAndSort. |
| `pages/product-list/product-search-and-sort.component.ts` | Component ProductSearchAndSort — từ `src/pages/Product/ProductPage.jsx` · selector `form[app-product-search-and-sort]`. |
| `pages/write-review/write-review-page.component.html` | Giao diện (template) của WriteReviewPage. |
| `pages/write-review/write-review-page.component.ts` | Trang WriteReviewPage — từ `src/pages/Product/WriteReviewPage.jsx` · selector `app-write-review-page`. |

### `src/app/features/customer/profile/`

| File | Chức năng |
| --- | --- |
| `pages/address-card.component.html` | Giao diện (template) của AddressCard. |
| `pages/address-card.component.ts` | Component AddressCard — từ `src/pages/User/UserProfilePage.jsx` · selector `article[app-address-card]`. |
| `pages/change-password-modal.component.html` | Giao diện (template) của ChangePasswordModal. |
| `pages/change-password-modal.component.ts` | Component ChangePasswordModal — từ `src/pages/User/UserProfilePage.jsx` · selector `div[app-change-password-modal]`. |
| `pages/user-profile-field.component.html` | Giao diện (template) của UserProfileField. |
| `pages/user-profile-field.component.ts` | Component UserProfileField — từ `src/pages/User/UserProfilePage.jsx` · selector `label[app-user-profile-field]`. |
| `pages/user-profile-page.component.html` | Giao diện (template) của UserProfilePage. |
| `pages/user-profile-page.component.ts` | Trang UserProfilePage — từ `src/pages/User/UserProfilePage.jsx` · selector `div[app-user-profile-page]`. |
| `pages/user-profile-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/User/UserProfilePage.jsx`). |

### `src/app/features/customer/rescue/`

| File | Chức năng |
| --- | --- |
| `components/adoption-application-modal-field-label.component.html` | Giao diện (template) của AdoptionApplicationModalFieldLabel. |
| `components/adoption-application-modal-field-label.component.ts` | Component AdoptionApplicationModalFieldLabel — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `label[app-adoption-application-modal-field-label]`. |
| `components/adoption-application-modal.component.html` | Giao diện (template) của AdoptionApplicationModal. |
| `components/adoption-application-modal.component.ts` | Component AdoptionApplicationModal — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `app-adoption-application-modal`. |
| `components/adoption-application-modal.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/rescue/AdoptionApplicationModal.jsx`). |
| `components/commitment-step.component.html` | Giao diện (template) của CommitmentStep. |
| `components/commitment-step.component.ts` | Component CommitmentStep — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `div[app-commitment-step]`. |
| `components/contact-field.component.html` | Giao diện (template) của ContactField. |
| `components/contact-field.component.ts` | Component ContactField — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `app-contact-field`. |
| `components/contact-step.component.html` | Giao diện (template) của ContactStep. |
| `components/contact-step.component.ts` | Component ContactStep — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `div[app-contact-step]`. |
| `components/field-error.component.html` | Giao diện (template) của FieldError. |
| `components/field-error.component.ts` | Component FieldError — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `app-field-error`. |
| `components/living-step.component.html` | Giao diện (template) của LivingStep. |
| `components/living-step.component.ts` | Component LivingStep — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `div[app-living-step]`. |
| `components/modal-button.component.html` | Giao diện (template) của ModalButton. |
| `components/modal-button.component.ts` | Component ModalButton — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `app-modal-button`. |
| `components/radio-pill.component.html` | Giao diện (template) của RadioPill. |
| `components/radio-pill.component.ts` | Component RadioPill — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `label[app-radio-pill]`. |
| `components/radio-question.component.html` | Giao diện (template) của RadioQuestion. |
| `components/radio-question.component.ts` | Component RadioQuestion — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `fieldset[app-radio-question]`. |
| `components/required-mark.component.html` | Giao diện (template) của RequiredMark. |
| `components/required-mark.component.ts` | Component RequiredMark — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `span[app-required-mark]`. |
| `components/step-progress.component.html` | Giao diện (template) của StepProgress. |
| `components/step-progress.component.ts` | Component StepProgress — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `div[app-step-progress]`. |
| `components/success-view.component.html` | Giao diện (template) của SuccessView. |
| `components/success-view.component.ts` | Component SuccessView — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `div[app-success-view]`. |
| `components/textarea-question.component.html` | Giao diện (template) của TextareaQuestion. |
| `components/textarea-question.component.ts` | Component TextareaQuestion — từ `src/components/rescue/AdoptionApplicationModal.jsx` · selector `div[app-textarea-question]`. |
| `data/adoption-form-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/adoptionFormData.js`. |
| `data/rescue-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/rescueData.js`. |
| `pages/adoption-request-card.component.html` | Giao diện (template) của AdoptionRequestCard. |
| `pages/adoption-request-card.component.ts` | Component AdoptionRequestCard — từ `src/pages/Rescue/RescuePage.jsx` · selector `article[app-adoption-request-card]`. |
| `pages/partner-card.component.html` | Giao diện (template) của PartnerCard. |
| `pages/partner-card.component.ts` | Component PartnerCard — từ `src/pages/Rescue/RescuePage.jsx` · selector `article[app-partner-card]`. |
| `pages/rescue-page.component.html` | Giao diện (template) của RescuePage. |
| `pages/rescue-page.component.ts` | Trang RescuePage — từ `src/pages/Rescue/RescuePage.jsx` · selector `div[app-rescue-page]`. |
| `pages/rescue-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Rescue/RescuePage.jsx`). |
| `pages/rescue-pet-card.component.html` | Giao diện (template) của RescuePetCard. |
| `pages/rescue-pet-card.component.ts` | Component RescuePetCard — từ `src/pages/Rescue/RescuePage.jsx` · selector `article[app-rescue-pet-card]`. |
| `pages/section-label.component.html` | Giao diện (template) của SectionLabel. |
| `pages/section-label.component.ts` | Component SectionLabel — từ `src/pages/Rescue/RescuePage.jsx` · selector `div[app-section-label]`. |

### `src/app/features/customer/search/`

| File | Chức năng |
| --- | --- |
| `pages/articles-section.component.html` | Giao diện (template) của ArticlesSection. |
| `pages/articles-section.component.ts` | Component ArticlesSection — từ `src/pages/Search/SearchResultsPage.jsx` · selector `section[app-articles-section]`. |
| `pages/community-post-card.component.html` | Giao diện (template) của CommunityPostCard. |
| `pages/community-post-card.component.ts` | Component CommunityPostCard — từ `src/pages/Search/SearchResultsPage.jsx` · selector `article[app-community-post-card]`. |
| `pages/demand-tabs.component.html` | Giao diện (template) của DemandTabs. |
| `pages/demand-tabs.component.ts` | Component DemandTabs — từ `src/pages/Search/SearchResultsPage.jsx` · selector `div[app-demand-tabs]`. |
| `pages/empty-results-content.component.html` | Giao diện (template) của EmptyResultsContent. |
| `pages/empty-results-content.component.ts` | Component EmptyResultsContent — từ `src/pages/Search/SearchResultsPage.jsx` · selector `section[app-empty-results-content]`. |
| `pages/filter-group.component.html` | Giao diện (template) của FilterGroup. |
| `pages/filter-group.component.ts` | Component FilterGroup — từ `src/pages/Search/SearchResultsPage.jsx` · selector `section[app-filter-group]`. |
| `pages/products-grid.component.html` | Giao diện (template) của ProductsGrid. |
| `pages/products-grid.component.ts` | Component ProductsGrid — từ `src/pages/Search/SearchResultsPage.jsx` · selector `div[app-products-grid]`. |
| `pages/products-section.component.html` | Giao diện (template) của ProductsSection. |
| `pages/products-section.component.ts` | Component ProductsSection — từ `src/pages/Search/SearchResultsPage.jsx` · selector `section[app-products-section]`. |
| `pages/results-header.component.html` | Giao diện (template) của ResultsHeader. |
| `pages/results-header.component.ts` | Component ResultsHeader — từ `src/pages/Search/SearchResultsPage.jsx` · selector `header[app-results-header]`. |
| `pages/search-results-content.component.html` | Giao diện (template) của SearchResultsContent. |
| `pages/search-results-content.component.ts` | Component SearchResultsContent — từ `src/pages/Search/SearchResultsPage.jsx` · selector `app-search-results-content`. |
| `pages/search-results-first-aid-card.component.html` | Giao diện (template) của SearchResultsFirstAidCard. |
| `pages/search-results-first-aid-card.component.ts` | Component SearchResultsFirstAidCard — từ `src/pages/Search/SearchResultsPage.jsx` · selector `article[app-search-results-first-aid-card]`. |
| `pages/search-results-page.component.html` | Giao diện (template) của SearchResultsPage. |
| `pages/search-results-page.component.ts` | Trang SearchResultsPage — từ `src/pages/Search/SearchResultsPage.jsx` · selector `div[app-search-results-page]`. |
| `pages/search-results-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Search/SearchResultsPage.jsx`). |
| `pages/search-results-section-heading.component.html` | Giao diện (template) của SearchResultsSectionHeading. |
| `pages/search-results-section-heading.component.ts` | Component SearchResultsSectionHeading — từ `src/pages/Search/SearchResultsPage.jsx` · selector `div[app-search-results-section-heading]`. |
| `pages/search-results-service-card.component.html` | Giao diện (template) của SearchResultsServiceCard. |
| `pages/search-results-service-card.component.ts` | Component SearchResultsServiceCard — từ `src/pages/Search/SearchResultsPage.jsx` · selector `article[app-search-results-service-card]`. |
| `pages/search-sidebar.component.html` | Giao diện (template) của SearchSidebar. |
| `pages/search-sidebar.component.ts` | Component SearchSidebar — từ `src/pages/Search/SearchResultsPage.jsx` · selector `aside[app-search-sidebar]`. |
| `pages/services-section.component.html` | Giao diện (template) của ServicesSection. |
| `pages/services-section.component.ts` | Component ServicesSection — từ `src/pages/Search/SearchResultsPage.jsx` · selector `section[app-services-section]`. |
| `pages/sort-button.component.html` | Giao diện (template) của SortButton. |
| `pages/sort-button.component.ts` | Component SortButton — từ `src/pages/Search/SearchResultsPage.jsx` · selector `button[app-sort-button]`. |

### `src/app/features/customer/shop/`

| File | Chức năng |
| --- | --- |
| `components/hero-slide-layer.component.html` | Giao diện (template) của HeroSlideLayer. |
| `components/hero-slide-layer.component.ts` | Component HeroSlideLayer — từ `src/components/shop/ShopHeroSection.jsx` · selector `div[app-hero-slide-layer]`. |
| `components/shop-hero-section.component.html` | Giao diện (template) của ShopHeroSection. |
| `components/shop-hero-section.component.ts` | Component ShopHeroSection — từ `src/components/shop/ShopHeroSection.jsx` · selector `section[app-shop-hero-section]`. |
| `components/shop-hero-section.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/shop/ShopHeroSection.jsx`). |
| `pages/shop-canvas.component.html` | Giao diện (template) của ShopCanvas. |
| `pages/shop-canvas.component.ts` | Component ShopCanvas — từ `src/pages/Shop/ShopPage.jsx` · selector `main[app-shop-canvas]`. |
| `pages/shop-page.component.html` | Giao diện (template) của ShopPage. |
| `pages/shop-page.component.ts` | Trang ShopPage — từ `src/pages/Shop/ShopPage.jsx` · selector `div[app-shop-page]`. |
| `pages/shop-page.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/pages/Shop/ShopPage.jsx`). |

### `src/app/layouts/customer/account-layout/`

| File | Chức năng |
| --- | --- |
| `account-layout.component.html` | Giao diện (template) của AccountLayout. |
| `account-layout.component.ts` | Layout AccountLayout — từ `src/layout/LayoutManagePet.jsx` · selector `div[app-account-layout]`. |

### `src/app/layouts/customer/components/`

| File | Chức năng |
| --- | --- |
| `footer/account-footer.component.html` | Giao diện (template) của AccountFooter. |
| `footer/account-footer.component.ts` | Component AccountFooter — từ `src/components/Footer/Footer.jsx` · selector `footer[app-account-footer]`. |
| `footer/footer-column.component.html` | Giao diện (template) của FooterColumn. |
| `footer/footer-column.component.ts` | Component FooterColumn — từ `src/components/Footer/Footer.jsx` · selector `section[app-footer-column]`. |
| `footer/footer-link.component.html` | Giao diện (template) của FooterLink. |
| `footer/footer-link.component.ts` | Component FooterLink — từ `src/components/Footer/Footer.jsx` · selector `li[app-footer-link]`. |
| `footer/footer.component.html` | Giao diện (template) của Footer. |
| `footer/footer.component.ts` | Component Footer — từ `src/components/Footer/Footer.jsx` · selector `app-footer`. |
| `footer/footer.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/Footer/Footer.jsx`). |
| `footer/mobile-footer-section.component.html` | Giao diện (template) của MobileFooterSection. |
| `footer/mobile-footer-section.component.ts` | Component MobileFooterSection — từ `src/components/Footer/Footer.jsx` · selector `section[app-mobile-footer-section]`. |
| `footer/mobile-footer.component.html` | Giao diện (template) của MobileFooter. |
| `footer/mobile-footer.component.ts` | Component MobileFooter — từ `src/components/Footer/Footer.jsx` · selector `footer[app-mobile-footer]`. |
| `footer/mobile-social-links.component.html` | Giao diện (template) của MobileSocialLinks. |
| `footer/mobile-social-links.component.ts` | Component MobileSocialLinks — từ `src/components/Footer/Footer.jsx` · selector `div[app-mobile-social-links]`. |
| `footer/tablet-contact-row.component.html` | Giao diện (template) của TabletContactRow. |
| `footer/tablet-contact-row.component.ts` | Component TabletContactRow — từ `src/components/Footer/Footer.jsx` · selector `p[app-tablet-contact-row]`. |
| `footer/tablet-footer-column.component.html` | Giao diện (template) của TabletFooterColumn. |
| `footer/tablet-footer-column.component.ts` | Component TabletFooterColumn — từ `src/components/Footer/Footer.jsx` · selector `section[app-tablet-footer-column]`. |
| `footer/tablet-footer-link.component.html` | Giao diện (template) của TabletFooterLink. |
| `footer/tablet-footer-link.component.ts` | Component TabletFooterLink — từ `src/components/Footer/Footer.jsx` · selector `app-tablet-footer-link`. |
| `footer/tablet-footer.component.html` | Giao diện (template) của TabletFooter. |
| `footer/tablet-footer.component.ts` | Component TabletFooter — từ `src/components/Footer/Footer.jsx` · selector `footer[app-tablet-footer]`. |
| `footer/tablet-social-links.component.html` | Giao diện (template) của TabletSocialLinks. |
| `footer/tablet-social-links.component.ts` | Component TabletSocialLinks — từ `src/components/Footer/Footer.jsx` · selector `div[app-tablet-social-links]`. |
| `navbar/figma-menu-icon.component.html` | Giao diện (template) của FigmaMenuIcon. |
| `navbar/figma-menu-icon.component.ts` | Component FigmaMenuIcon — từ `src/components/Navbar/MobileNavBar.jsx` · selector `app-figma-menu-icon`. |
| `navbar/highlighted-text.component.html` | Giao diện (template) của HighlightedText. |
| `navbar/highlighted-text.component.ts` | Component HighlightedText — từ `src/components/Navbar/SearchSuggestionDropdown.jsx` · selector `app-highlighted-text`. |
| `navbar/mobile-menu-panel.component.html` | Giao diện (template) của MobileMenuPanel. |
| `navbar/mobile-menu-panel.component.ts` | Component MobileMenuPanel — từ `src/components/Navbar/MobileNavBar.jsx` · selector `app-mobile-menu-panel`. |
| `navbar/mobile-nav-bar.component.html` | Giao diện (template) của MobileNavBar. |
| `navbar/mobile-nav-bar.component.ts` | Component MobileNavBar — từ `src/components/Navbar/MobileNavBar.jsx` · selector `app-mobile-nav-bar`. |
| `navbar/mobile-nav-bar.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/Navbar/MobileNavBar.jsx`). |
| `navbar/mobile-search-panel.component.html` | Giao diện (template) của MobileSearchPanel. |
| `navbar/mobile-search-panel.component.ts` | Component MobileSearchPanel — từ `src/components/Navbar/MobileNavBar.jsx` · selector `app-mobile-search-panel`. |
| `navbar/nav-bar-authenticated.component.html` | Giao diện (template) của NavBarAuthenticated. |
| `navbar/nav-bar-authenticated.component.ts` | Component NavBarAuthenticated — từ `src/components/Navbar/NavBarAuthenticated.jsx` · selector `app-nav-bar-authenticated`. |
| `navbar/nav-bar-button.component.html` | Giao diện (template) của NavBarButton. |
| `navbar/nav-bar-button.component.ts` | Component NavBarButton — từ `src/components/Navbar/NavBarButton.jsx` · selector `app-nav-bar-button`. |
| `navbar/nav-bar-guest.component.html` | Giao diện (template) của NavBarGuest. |
| `navbar/nav-bar-guest.component.ts` | Component NavBarGuest — từ `src/components/Navbar/NavBarGuest.jsx` · selector `app-nav-bar-guest`. |
| `navbar/nav-bar.component.html` | Giao diện (template) của NavBar. |
| `navbar/nav-bar.component.ts` | Component NavBar — từ `src/components/Navbar/NavBar.jsx` · selector `app-nav-bar`. |
| `navbar/nav-links.component.html` | Giao diện (template) của NavLinks. |
| `navbar/nav-links.component.ts` | Component NavLinks — từ `src/components/Navbar/NavLinks.jsx` · selector `nav[app-nav-links]`. |
| `navbar/nav-search-bar.component.html` | Giao diện (template) của NavSearchBar. |
| `navbar/nav-search-bar.component.ts` | Component NavSearchBar — từ `src/components/Navbar/NavSearchBar.jsx` · selector `form[app-nav-search-bar]`. |
| `navbar/nav-search-bar.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/Navbar/MobileNavBar.jsx`). |
| `navbar/nav-user-menu.component.html` | Giao diện (template) của NavUserMenu. |
| `navbar/nav-user-menu.component.ts` | Component NavUserMenu — từ `src/components/Navbar/NavUserMenu.jsx` · selector `div[app-nav-user-menu]`. |
| `navbar/nav-user-menu.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/Navbar/MobileNavBar.jsx`). |
| `navbar/product-suggestion-card.component.html` | Giao diện (template) của ProductSuggestionCard. |
| `navbar/product-suggestion-card.component.ts` | Component ProductSuggestionCard — từ `src/components/Navbar/SearchSuggestionDropdown.jsx` · selector `button[app-product-suggestion-card]`. |
| `navbar/search-asset-icon.component.html` | Giao diện (template) của SearchAssetIcon. |
| `navbar/search-asset-icon.component.ts` | Component SearchAssetIcon — từ `src/components/Navbar/MobileNavBar.jsx` · selector `img[app-search-asset-icon]`. |
| `navbar/search-suggestion-dropdown.component.html` | Giao diện (template) của SearchSuggestionDropdown. |
| `navbar/search-suggestion-dropdown.component.ts` | Component SearchSuggestionDropdown — từ `src/components/Navbar/SearchSuggestionDropdown.jsx` · selector `app-search-suggestion-dropdown`. |
| `navbar/search-suggestion-status.component.html` | Giao diện (template) của SearchSuggestionStatus. |
| `navbar/search-suggestion-status.component.ts` | Component SearchSuggestionStatus — từ `src/components/Navbar/SearchSuggestionDropdown.jsx` · selector `div[app-search-suggestion-status]`. |
| `navbar/tablet-search-trigger.component.html` | Giao diện (template) của TabletSearchTrigger. |
| `navbar/tablet-search-trigger.component.ts` | Component TabletSearchTrigger — từ `src/components/Navbar/MobileNavBar.jsx` · selector `button[app-tablet-search-trigger]`. |
| `navbar/text-suggestion-item.component.html` | Giao diện (template) của TextSuggestionItem. |
| `navbar/text-suggestion-item.component.ts` | Component TextSuggestionItem — từ `src/components/Navbar/SearchSuggestionDropdown.jsx` · selector `button[app-text-suggestion-item]`. |
| `notifications/notification-bell.component.html` | Giao diện (template) của NotificationBell. |
| `notifications/notification-bell.component.ts` | Component NotificationBell — từ `src/components/Notifications/NotificationBell.jsx` · selector `app-notification-bell`. |
| `notifications/notification-bell.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/Notifications/NotificationBell.jsx`). |
| `notifications/notification-item.component.html` | Giao diện (template) của NotificationItem. |
| `notifications/notification-item.component.ts` | Component NotificationItem — từ `src/components/Notifications/NotificationPopup.jsx` · selector `button[app-notification-item]`. |
| `notifications/notification-message.component.html` | Giao diện (template) của NotificationMessage. |
| `notifications/notification-message.component.ts` | Component NotificationMessage — từ `src/components/Notifications/NotificationPopup.jsx` · selector `p[app-notification-message]`. |
| `notifications/notification-popup.component.html` | Giao diện (template) của NotificationPopup. |
| `notifications/notification-popup.component.ts` | Component NotificationPopup — từ `src/components/Notifications/NotificationPopup.jsx` · selector `section[app-notification-popup]`. |
| `notifications/notification-popup.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/Notifications/NotificationBell.jsx`). |
| `notifications/notification-visual.component.html` | Giao diện (template) của NotificationVisual. |
| `notifications/notification-visual.component.ts` | Component NotificationVisual — từ `src/components/Notifications/NotificationPopup.jsx` · selector `app-notification-visual`. |
| `sidebar/sidebar.component.html` | Giao diện (template) của Sidebar. |
| `sidebar/sidebar.component.ts` | Component Sidebar — từ `src/components/Sidebar/Sidebar.jsx` · selector `div[app-sidebar]`. |

### `src/app/layouts/customer/constants/`

| File | Chức năng |
| --- | --- |
| `navbar-menu-links.ts` | Hằng số — từ `src/components/Navbar/navbarMenuLinks.js`. |
| `user-menu-links.ts` | Hằng số — từ `src/components/Navbar/userMenuLinks.js`. |

### `src/app/layouts/customer/customer-layout/`

| File | Chức năng |
| --- | --- |
| `customer-layout.component.html` | Template khung gốc Customer. |
| `customer-layout.component.ts` | Khung gốc Customer: nạp customer.css, router-outlet, các popup toàn site, cuộn lên đầu khi đổi trang (thay App.jsx). |

### `src/app/layouts/customer/data/`

| File | Chức năng |
| --- | --- |
| `notification-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/notificationData.js`. |

### `src/app/shared/customer/assets/`

| File | Chức năng |
| --- | --- |
| `appointment-images.ts` | Đường dẫn ảnh — từ `src/assets/appointmentImages.js`. |
| `auth-images.ts` | Đường dẫn ảnh — từ `src/assets/authImages.js`. |
| `blog-images.ts` | Đường dẫn ảnh — từ `src/assets/blogImages.js`. |
| `booking-images.ts` | Đường dẫn ảnh — từ `src/assets/bookingImages.js`. |
| `cart-images.ts` | Đường dẫn ảnh — từ `src/assets/cartImages.js`. |
| `footer-images.ts` | Đường dẫn ảnh — từ `src/assets/footerImages.js`. |
| `grooming-images.ts` | Đường dẫn ảnh — từ `src/assets/groomingImages.js`. |
| `home-images.ts` | Đường dẫn ảnh — từ `src/assets/homeImages.js`. |
| `navbar-images.ts` | Đường dẫn ảnh — từ `src/assets/navbarImages.js`. |
| `notification-images.ts` | Đường dẫn ảnh — từ `src/assets/notificationImages.js`. |
| `policy-images.ts` | Đường dẫn ảnh — từ `src/assets/policyImages.js`. |
| `product-card-assets.ts` | Đường dẫn ảnh — từ `src/components/product/productCardAssets.js`. |
| `product-images.ts` | Đường dẫn ảnh — từ `src/assets/productImages.js`. |
| `rescue-images.ts` | Đường dẫn ảnh — từ `src/assets/rescueImages.js`. |
| `search-suggestion-images.ts` | Đường dẫn ảnh — từ `src/assets/searchSuggestionImages.js`. |
| `shop-images.ts` | Đường dẫn ảnh — từ `src/assets/shopImages.js`. |

### `src/app/shared/customer/components/`

| File | Chức năng |
| --- | --- |
| `address-form-modal/address-form-field.component.html` | Giao diện (template) của AddressFormField. |
| `address-form-modal/address-form-field.component.ts` | Component AddressFormField — từ `src/components/address/AddressFormModal.jsx` · selector `label[app-address-form-field]`. |
| `address-form-modal/address-form-modal.component.html` | Giao diện (template) của AddressFormModal. |
| `address-form-modal/address-form-modal.component.ts` | Component AddressFormModal — từ `src/components/address/AddressFormModal.jsx` · selector `div[app-address-form-modal]`. |
| `address-form-modal/address-form-modal.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/address/AddressFormModal.jsx`). |
| `alert/alert.component.html` | Giao diện (template) của Alert. |
| `alert/alert.component.ts` | Component Alert — từ `src/components/Alert/Alert.jsx` · selector `div[app-alert]`. |
| `blog-card/blog-card.component.html` | Giao diện (template) của BlogCard. |
| `blog-card/blog-card.component.ts` | Component BlogCard — từ `src/components/blog/BlogCard.jsx` · selector `article[app-blog-card]`. |
| `blog-card/category-badge.component.html` | Giao diện (template) của CategoryBadge. |
| `blog-card/category-badge.component.ts` | Component CategoryBadge — từ `src/components/blog/BlogCard.jsx` · selector `span[app-category-badge]`. |
| `blog-card/category-icon.component.html` | Giao diện (template) của CategoryIcon. |
| `blog-card/category-icon.component.ts` | Component CategoryIcon — từ `src/components/blog/BlogCard.jsx` · selector `app-category-icon`. |
| `breadcrumb/breadcrumb.component.html` | Giao diện (template) của Breadcrumb. |
| `breadcrumb/breadcrumb.component.ts` | Component Breadcrumb — từ `src/components/layout/Breadcrumb.jsx` · selector `nav[app-breadcrumb]`. |
| `canvas-layout/canvas-layout.component.html` | Giao diện (template) của CanvasLayout. |
| `canvas-layout/canvas-layout.component.ts` | Layout CanvasLayout — từ `src/components/layout/CanvasLayout.jsx` · selector `div[app-canvas-layout]`. |
| `coupon-input/coupon-input.component.html` | Giao diện (template) của CouponInput. |
| `coupon-input/coupon-input.component.ts` | Component CouponInput — từ `src/components/ui/CouponInput.jsx` · selector `div[app-coupon-input]`. |
| `customer-button/customer-button.component.html` | Giao diện (template) của CustomerButton. |
| `customer-button/customer-button.component.ts` | Component CustomerButton — từ `src/components/Button/ButtonComponent.jsx` · selector `button[app-customer-button]`. |
| `customer-loading/customer-loading.component.html` | Giao diện (template) của CustomerLoading. |
| `customer-loading/customer-loading.component.ts` | Component CustomerLoading — từ `src/components/Loading/Loading.jsx` · selector `app-customer-loading`. |
| `decision-modal/decision-modal.component.html` | Template popup xác nhận. |
| `decision-modal/decision-modal.component.ts` | Component DecisionModal — từ `src/components/shared/DecisionModal.jsx` · selector `app-decision-modal`. |
| `decision-modal/warning-mark.component.html` | Giao diện (template) của WarningMark. |
| `decision-modal/warning-mark.component.ts` | Component WarningMark — từ `src/components/shared/DecisionModal.jsx` · selector `div[app-warning-mark]`. |
| `feedback-section/feedback-card.component.html` | Giao diện (template) của FeedbackCard. |
| `feedback-section/feedback-card.component.ts` | Component FeedbackCard — từ `src/components/shop/FeedbackSection.jsx` · selector `article[app-feedback-card]`. |
| `feedback-section/feedback-dot.component.html` | Giao diện (template) của FeedbackDot. |
| `feedback-section/feedback-dot.component.ts` | Component FeedbackDot — từ `src/components/shop/FeedbackSection.jsx` · selector `button[app-feedback-dot]`. |
| `feedback-section/feedback-section.component.html` | Giao diện (template) của FeedbackSection. |
| `feedback-section/feedback-section.component.ts` | Component FeedbackSection — từ `src/components/shop/FeedbackSection.jsx` · selector `section[app-feedback-section]`. |
| `feedback-section/feedback-section.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/shop/FeedbackSection.jsx`). |
| `icon/customer-icon.component.ts` | Icon SVG <app-customer-icon name="..."> (thay lucide-react, @ant-design/icons). |
| `icon/customer-icons.ts` | Danh sách icon SVG (thêm icon mới ở đây). |
| `pet-care-faq-section/pet-care-faq-section.component.html` | Giao diện (template) của PetCareFaqSection. |
| `pet-care-faq-section/pet-care-faq-section.component.ts` | Component PetCareFaqSection — từ `src/components/shared/PetCareFaqSection.jsx` · selector `section[app-pet-care-faq-section]`. |
| `product-card/product-card.component.html` | Giao diện (template) của ProductCard. |
| `product-card/product-card.component.ts` | Component ProductCard — từ `src/components/product/ProductCard.jsx` · selector `app-product-card`. |
| `product-card/product-card.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/product/ProductCard.jsx`). |
| `product-rating/product-rating.component.html` | Giao diện (template) của ProductRating. |
| `product-rating/product-rating.component.ts` | Component ProductRating — từ `src/components/product/ProductRating.jsx` · selector `app-product-rating`. |
| `product-rating/rating-star.component.html` | Giao diện (template) của RatingStar. |
| `product-rating/rating-star.component.ts` | Component RatingStar — từ `src/components/product/ProductRating.jsx` · selector `app-rating-star`. |
| `scaled-canvas-layout/scaled-canvas-layout.component.html` | Template canvas thu nhỏ. |
| `scaled-canvas-layout/scaled-canvas-layout.component.ts` | Layout ScaledCanvasLayout — từ `src/components/layout/ScaledCanvasLayout.jsx` · selector `div[app-scaled-canvas-layout]`. |
| `scaled-canvas-layout/scaled-canvas-layout.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/layout/ScaledCanvasLayout.jsx`). |
| `section-title/section-title.component.html` | Giao diện (template) của SectionTitle. |
| `section-title/section-title.component.ts` | Component SectionTitle — từ `src/components/home/SectionTitle.jsx` · selector `div[app-section-title]`. |
| `shopping-product-card/shopping-product-card.component.html` | Template thẻ sản phẩm trang mua sắm. |
| `shopping-product-card/shopping-product-card.component.ts` | Component ShoppingProductCard — từ `src/components/product/ShoppingProductCard.jsx` · selector `app-shopping-product-card`. |
| `yellow-button/yellow-button.component.html` | Giao diện (template) của YellowButton. |
| `yellow-button/yellow-button.component.ts` | Component YellowButton — từ `src/components/home/YellowButton.jsx` · selector `app-yellow-button`. |
| `yellow-button/yellow-button.helpers.ts` | Hằng số/hàm tiện ích dùng chung cho các component cùng thư mục (từ `src/components/home/YellowButton.jsx`). |

### `src/app/shared/customer/data/`

| File | Chức năng |
| --- | --- |
| `blog-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/blogData.js`. |
| `community-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/communityData.js`. |
| `feedback-data.ts` | Dữ liệu mẫu / hằng số — từ `src/components/shop/feedbackData.js`. |
| `first-aid-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/firstAidData.js`. |
| `grooming-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/groomingData.js`. |
| `search-results-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/searchResultsData.js`. |
| `shop-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/shopData.js`. |
| `site-data.ts` | Dữ liệu mẫu / hằng số — từ `src/data/siteData.js`. |

### `src/app/shared/customer/directives/`

| File | Chức năng |
| --- | --- |
| `customer-link.directive.ts` | <a appCustomerLink="/url"> điều hướng SPA + isActive (thay Link/NavLink). |
| `react-style.directive.ts` | [appStyle]="{...}" gán style giống React (camelCase, số tự thêm px). |
| `select-value.directive.ts` | [selectValue] chọn đúng option cho <select> (giống value={} của React). |

### `src/app/shared/customer/pipes/`

| File | Chức năng |
| --- | --- |
| `trust-resource-url.pipe.ts` | Pipe cho phép URL động trong <iframe [src]> (bản đồ). |

### `src/app/shared/customer/styles/`

| File | Chức năng |
| --- | --- |
| `customer.scss` | CSS toàn cục của Customer: Tailwind + preflight thu hẹp + style chuyển từ index.css. |

### `src/app/shared/customer/utils/`

| File | Chức năng |
| --- | --- |
| `canvas-scale.ts` | Tính tỉ lệ thu nhỏ canvas 1440px (thay hooks/useCanvasScale.js). |
| `carousel-keyboard.ts` | Phím ← → điều khiển carousel (thay hooks/useCarouselKeyboard.js). |
| `currency.ts` | Hàm tiện ích — từ `src/utils/currency.js`. |
| `payment-countdown.ts` | Đếm ngược thời gian thanh toán (thay hook usePaymentCountdown). |
| `react-setter.ts` | Tạo hàm set kiểu React từ signal để truyền cho component con. |
| `search-suggestion.utils.ts` | Hàm tiện ích — từ `src/utils/searchSuggestionUtils.js`. |
