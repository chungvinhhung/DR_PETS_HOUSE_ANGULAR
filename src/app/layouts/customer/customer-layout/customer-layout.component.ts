import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthModalComponent } from '../../../features/customer/auth/components/auth-modal.component';
import { BankTransferModalComponent } from '../../../features/customer/checkout/components/bank-transfer-modal.component';
import { CartDrawerComponent } from '../../../features/customer/cart/components/cart-drawer.component';
import { CheckoutOverlayComponent } from '../../../features/customer/checkout/components/checkout-overlay.component';
import { GuestOrderSuccessOverlayComponent } from '../../../features/customer/checkout/components/guest-order-success-overlay.component';
import { OrderSuccessOverlayComponent } from '../../../features/customer/checkout/components/order-success-overlay.component';
import { DecisionModalComponent } from '../../../shared/customer/components/decision-modal/decision-modal.component';
import { AUTH_MODAL_PARAM, CustomerAuthService } from '../../../core/customer/services/customer-auth.service';
import { RETURN_URL_PARAM } from '../../../core/utils/return-url';

const CUSTOMER_STYLESHEET_ID = 'customer-stylesheet';

/**
 * KHUNG GỐC CỦA GIAO DIỆN CUSTOMER (thay cho views/App.jsx + các Provider của React).
 *
 * - Nạp file CSS riêng của Customer (customer.css: Tailwind + style chuyển từ index.css) khi vào trang.
 * - <router-outlet>: nơi hiển thị các trang (mỗi trang tự đặt NavBar/Footer như bản React,
 *   vì mỗi trang có kiểu canvas & màu footer khác nhau).
 * - Các popup dùng chung toàn site: đăng nhập, giỏ hàng, thanh toán, chuyển khoản,
 *   đặt hàng thành công, hộp thoại xác nhận. Trạng thái đóng/mở nằm trong các service ở core/customer/services.
 * - Tự cuộn lên đầu trang khi đổi trang (thay cho components/layout/ScrollToTop.jsx).
 */
@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    AuthModalComponent,
    CartDrawerComponent,
    CheckoutOverlayComponent,
    BankTransferModalComponent,
    OrderSuccessOverlayComponent,
    GuestOrderSuccessOverlayComponent,
    DecisionModalComponent,
  ],
  templateUrl: './customer-layout.component.html',
  styleUrl: './customer-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerLayoutComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly authService = inject(CustomerAuthService);

  /** Chỉ hiển thị nội dung khi CSS đã tải xong để tránh "nháy" giao diện chưa có style. */
  protected readonly stylesReady = signal(false);

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.openLoginFromUrl();
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      this.document.documentElement.scrollTop = 0;
      this.document.body.scrollTop = 0;
    });
  }

  ngOnInit(): void {
    this.loadCustomerStylesheet();
  }

  /**
   * Callback URL: /?auth=login&returnUrl=/don-hang-cua-toi -> mở popup đăng nhập,
   * đăng nhập xong chuyển tới returnUrl (CustomerAuthService đã kiểm tra an toàn).
   */
  private openLoginFromUrl(): void {
    const params = this.router.parseUrl(this.router.url).queryParamMap;
    if (params.get(AUTH_MODAL_PARAM) !== 'login' && !params.has(RETURN_URL_PARAM)) return;
    this.authService.loginWithReturnUrl(params.get(RETURN_URL_PARAM) ?? '/');
  }

  private loadCustomerStylesheet(): void {
    const existing = this.document.getElementById(CUSTOMER_STYLESHEET_ID) as HTMLLinkElement | null;
    if (existing) {
      this.stylesReady.set(true);
      return;
    }
    const link = this.document.createElement('link');
    link.id = CUSTOMER_STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = 'customer.css';
    link.onload = () => this.stylesReady.set(true);
    link.onerror = () => this.stylesReady.set(true);
    this.document.head.appendChild(link);
  }
}
