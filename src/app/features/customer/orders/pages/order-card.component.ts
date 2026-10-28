import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, OnInit } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { ProductSummaryComponent } from './product-summary.component';
import { OrderPagesPaymentCountdownComponent } from './order-pages-payment-countdown.component';
import { OrderActionsComponent } from './order-actions.component';
import { formatCurrency, formatOrderDate, getOrderTotal, ORDER_STATUS } from '../data/order-data';

/**
 * OrderCard — chuyển từ React: src/pages/Order/OrderPages.jsx
 */
@Component({
  selector: 'article[app-order-card]',
  standalone: true,
  imports: [ProductSummaryComponent, OrderPagesPaymentCountdownComponent, OrderActionsComponent],
  templateUrl: './order-card.component.html',
  host: {
    'class': 'rounded-[16px] border border-[#C2C6D4] bg-white px-[21px] py-[11px] transition hover:border-[#1976D2] hover:shadow-md',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderCardComponent implements OnInit {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);

  // --- Input / Output (props của React) ---
  readonly order = input<any>(undefined);
  readonly actionMessage = input<any>(undefined);
  readonly actionMessageType = input<any>(undefined);
  readonly isActionLoading = input<any>(undefined);
  readonly onReorder = output<any>();
  readonly onRepay = output<any>();
  readonly onCancel = output<any>();
  readonly onReview = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly formatOrderDate: any = formatOrderDate;
  protected readonly formatCurrency: any = formatCurrency;
  protected readonly getOrderTotal: any = getOrderTotal;

  // --- Giá trị tính toán (computed) ---
  readonly status = computed<any>(() => (ORDER_STATUS as any)[this.order().status] || ORDER_STATUS.processing);
  readonly products = computed<any>(() => Array.isArray(this.order().products) ? this.order().products : []);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly paymentExpired = signal<any>(undefined);

  ngOnInit(): void {
    this.paymentExpired.set(this.order().status === "awaiting_payment" && new Date(this.order().paymentExpiresAt).getTime() <= Date.now());
  }

  protected openDetails() {
    return this.navService.navigate(`/don-hang-cua-toi/${this.order().id}`);
  }

  protected handle1(event: any) {
    if (event.key === "Enter" || event.key === " ") this.openDetails();
  }
}
