import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { BookingPaymentStepComponent } from '../../booking/components/booking-payment-step.component';
import { BookingSuccessModalComponent } from '../../booking/components/booking-success-modal.component';
import { ShoppingCheckoutComponent } from './shopping-checkout.component';
import { reactSetter } from '../../../../shared/customer/utils/react-setter';

/**
 * Checkout — chuyển từ React: src/components/checkout/Checkout.jsx
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [BookingPaymentStepComponent, BookingSuccessModalComponent, ShoppingCheckoutComponent],
  templateUrl: './checkout.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutComponent {
  // --- Input / Output (props của React) ---
  readonly mode = input<any>("shopping");
  readonly isOpen = input<any>(true);
  readonly onBack = output<any>();

  // --- Trạng thái (signal = useState / useRef) ---
  readonly paymentMode = signal<any>("store");
  readonly success = signal<any>(false);

  /** Hàm set kiểu React cho signal "paymentMode" (dùng khi truyền cho component con / callback) */
  protected readonly setPaymentModeFn = reactSetter(this.paymentMode);

  protected handleAppointmentConfirm() {
    this.success.set(true);
  }
}
