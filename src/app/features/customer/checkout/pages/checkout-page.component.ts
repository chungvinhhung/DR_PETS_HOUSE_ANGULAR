import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

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
  styleUrl: './checkout-page.component.scss',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly mode = computed(() => {
    const qMode = this.route.snapshot.queryParamMap.get('mode');
    return qMode === 'appointment' ? 'appointment' : 'shopping';
  });
}
