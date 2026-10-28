import { ChangeDetectionStrategy, Component } from '@angular/core';

import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { CheckoutComponent } from '../components/checkout.component';

/**
 * CheckoutPage — chuyển từ React: src/pages/Checkout/CheckoutPage.jsx
 */
@Component({
  selector: 'div[app-checkout-page]',
  standalone: true,
  imports: [NavBarComponent, CheckoutComponent],
  templateUrl: './checkout-page.component.html',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent {
}
