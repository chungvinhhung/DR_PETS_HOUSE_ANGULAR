import { Routes } from '@angular/router';

import { customerAuthGuard } from '../../core/customer/guards/customer-auth.guard';

/**
 * ROUTE CỦA GIAO DIỆN KHÁCH HÀNG (chuyển từ routes/AppRoutes.jsx của React).
 *
 * - Được nạp dưới CustomerLayoutComponent (xem app.routes.ts).
 * - Mỗi trang dùng loadComponent (lazy load) -> chỉ tải code của trang khi người dùng mở trang đó.
 * - Giữ nguyên cả đường dẫn tiếng Việt và tiếng Anh như bản React (vd. /cua-hang và /petshop).
 * - Các trang tài khoản (thông tin, thú cưng, lịch sử...) dùng AccountLayoutComponent (có sidebar)
 *   và được bảo vệ bởi customerAuthGuard.
 */
const home = () => import('./home/pages/home-page.component').then((m) => m.HomePageComponent);
const booking = () => import('./booking/pages/booking/booking-page.component').then((m) => m.BookingPageComponent);
const shop = () => import('./shop/pages/shop-page.component').then((m) => m.ShopPageComponent);
const productList = () => import('./products/pages/product-list/product-page.component').then((m) => m.ProductPageComponent);
const productDetails = () => import('./products/pages/product-details/product-details-page.component').then((m) => m.ProductDetailsPageComponent);
const writeReview = () => import('./products/pages/write-review/write-review-page.component').then((m) => m.WriteReviewPageComponent);
const cartOpen = () => import('./cart/pages/cart-open-handler.component').then((m) => m.CartOpenHandlerComponent);
const blog = () => import('./blog/pages/blog/blog-page.component').then((m) => m.BlogPageComponent);
const blogDetail = () => import('./blog/pages/blog-detail/blog-detail-page.component').then((m) => m.BlogDetailPageComponent);
const community = () => import('./blog/pages/community/community-page.component').then((m) => m.CommunityPageComponent);
const firstAid = () => import('./blog/pages/first-aid/first-aid-page.component').then((m) => m.FirstAidPageComponent);
const firstAidDetail = () => import('./blog/pages/first-aid-detail/first-aid-detail-page.component').then((m) => m.FirstAidDetailPageComponent);
const rescue = () => import('./rescue/pages/rescue-page.component').then((m) => m.RescuePageComponent);
const search = () => import('./search/pages/search-results-page.component').then((m) => m.SearchResultsPageComponent);
const about = () => import('./about/pages/about-page.component').then((m) => m.AboutPageComponent);
const contact = () => import('./contact/pages/contact-page.component').then((m) => m.ContactPageComponent);
const policy = () => import('./policy/pages/policy-page.component').then((m) => m.PolicyPageComponent);
const groomingSpa = () => import('./clinic-services/pages/grooming-spa/grooming-spa-page.component').then((m) => m.GroomingSpaPageComponent);
const medicalTreatment = () =>
  import('./clinic-services/pages/medical-treatment/medical-treatment-page.component').then((m) => m.MedicalTreatmentPageComponent);
const checkout = () => import('./checkout/pages/checkout-page.component').then((m) => m.CheckoutPageComponent);
const notFound = () => import('./not-found/pages/not-found-page.component').then((m) => m.NotFoundPageComponent);

export const CUSTOMER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', loadComponent: home, title: "Dr. Pet's House - Trung tâm chăm sóc thú cưng" },

  { path: 'dat-lich', loadComponent: booking },
  { path: 'booking', loadComponent: booking },

  { path: 'petshop', loadComponent: shop },
  { path: 'cua-hang', loadComponent: shop },
  { path: 'shop', loadComponent: shop },
  { path: 'products', loadComponent: productList },
  { path: 'san-pham', loadComponent: productList },
  { path: 'product-details', loadComponent: productDetails },
  { path: 'product-details/:productId', loadComponent: productDetails },
  { path: 'product-details/:productId/write-review', canActivate: [customerAuthGuard], loadComponent: writeReview },
  { path: 'cart', loadComponent: cartOpen },

  { path: 'blog', loadComponent: blog },
  { path: 'bai-viet', loadComponent: blog },
  { path: 'blog/kien-thuc', loadComponent: blog },
  { path: 'bai-viet/kien-thuc', loadComponent: blog },
  { path: 'blog/so-cuu', loadComponent: firstAid },
  { path: 'bai-viet/so-cuu', loadComponent: firstAid },
  { path: 'blog/so-cuu/:postId', loadComponent: firstAidDetail },
  { path: 'bai-viet/so-cuu/:postId', loadComponent: firstAidDetail },
  { path: 'blog/cong-dong', loadComponent: community },
  { path: 'bai-viet/cong-dong', loadComponent: community },
  { path: 'blog/:postId', loadComponent: blogDetail },
  { path: 'bai-viet/:postId', loadComponent: blogDetail },

  { path: 'rescue', loadComponent: rescue },
  { path: 'cuu-tro', loadComponent: rescue },
  { path: 'pets/adoption', loadComponent: rescue },
  { path: 'first-aid', loadComponent: firstAid },
  { path: 'first-aid/:postId', loadComponent: firstAidDetail },
  { path: 'profile', redirectTo: 'thong-tin-nguoi-dung', pathMatch: 'full' },
  { path: 'my-pets', redirectTo: 'thu-cung-cua-toi', pathMatch: 'full' },
  { path: 'tracking', redirectTo: 'don-hang-cua-toi', pathMatch: 'full' },
  { path: 'my-orders', redirectTo: 'don-hang-cua-toi', pathMatch: 'full' },
  { path: 'my-appointments', redirectTo: 'lich-su-dat-lich', pathMatch: 'full' },
  { path: 'appointment/history', redirectTo: 'lich-su-dat-lich', pathMatch: 'full' },
  { path: 'appointment-history', redirectTo: 'lich-su-dat-lich', pathMatch: 'full' },
  { path: 'appointments', redirectTo: 'lich-su-dat-lich', pathMatch: 'full' },
  { path: 'search', loadComponent: search },
  { path: 'about', loadComponent: about },
  { path: 've-chung-toi', loadComponent: about },
  { path: 'contact', loadComponent: contact },
  { path: 'lien-he', loadComponent: contact },
  { path: 'policy', loadComponent: policy },
  { path: 'policies/doi-tra-hang', loadComponent: policy },
  { path: 'policies/:slug', loadComponent: policy },

  { path: 'services/grooming-spa', loadComponent: groomingSpa },
  { path: 'services/groomng-spa', loadComponent: groomingSpa },
  { path: 'services/kham-dieu-tri', loadComponent: medicalTreatment },
  { path: 'dich-vu', loadComponent: medicalTreatment },
  { path: 'dich-vu/grooming-spa', loadComponent: groomingSpa },
  { path: 'dich-vu/kham-dieu-tri', loadComponent: medicalTreatment },
  { path: 'checkout', loadComponent: checkout },

  // Nhóm trang tài khoản: có sidebar riêng, bắt buộc đăng nhập
  {
    path: '',
    canActivate: [customerAuthGuard],
    loadComponent: () => import('../../layouts/customer/account-layout/account-layout.component').then((m) => m.AccountLayoutComponent),
    children: [
      {
        path: 'thong-tin-nguoi-dung',
        loadComponent: () => import('./profile/pages/user-profile-page.component').then((m) => m.UserProfilePageComponent),
      },
      {
        path: 'thu-cung-cua-toi',
        loadComponent: () => import('./pets/pages/my-pet/pet-list-page.component').then((m) => m.PetListPageComponent),
      },
      {
        path: 'thu-cung-cua-toi/them-moi',
        loadComponent: () => import('./pets/pages/pet-form/pet-form-page.component').then((m) => m.PetFormPageComponent),
      },
      {
        path: 'thu-cung-cua-toi/:id',
        loadComponent: () => import('./pets/pages/pet-detail/pet-detail-page.component').then((m) => m.PetDetailPageComponent),
      },
      {
        path: 'thu-cung-cua-toi/:id/chinh-sua',
        loadComponent: () => import('./pets/pages/pet-form/pet-form-page.component').then((m) => m.PetFormPageComponent),
      },
      {
        path: 'lich-su-dat-lich',
        loadComponent: () =>
          import('./booking/pages/appointment-history/appointment-history-page.component').then((m) => m.AppointmentHistoryPageComponent),
      },
      {
        path: 'don-hang-cua-toi',
        loadComponent: () => import('./orders/pages/my-orders-page.component').then((m) => m.MyOrdersPageComponent),
      },
      {
        path: 'don-hang-cua-toi/:orderId',
        loadComponent: () => import('./orders/pages/order-details-page.component').then((m) => m.OrderDetailsPageComponent),
      },
    ],
  },

  { path: '**', loadComponent: notFound },
];
