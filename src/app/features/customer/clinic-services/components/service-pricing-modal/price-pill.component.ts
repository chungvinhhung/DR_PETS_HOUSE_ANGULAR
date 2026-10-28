import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { columnToneClasses } from './service-pricing-modal.helpers';

/**
 * PricePill — chuyển từ React: src/components/groomingSpa/ServicePricingModal.jsx
 */
@Component({
  selector: 'div[app-price-pill]',
  standalone: true,
  imports: [],
  templateUrl: './price-pill.component.html',
  host: {
    '[class]': '`flex h-[40px] w-[80px] shrink-0 items-center justify-center rounded-[16px] border bg-white ${columnToneClasses[tone()]}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricePillComponent {
  // --- Input / Output (props của React) ---
  readonly value = input<any>(undefined);
  readonly tone = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly columnToneClasses: any = columnToneClasses;

  // --- Giá trị tính toán (computed) ---
  readonly isContact = computed<any>(() => this.value() === 'Liên hệ');

}
