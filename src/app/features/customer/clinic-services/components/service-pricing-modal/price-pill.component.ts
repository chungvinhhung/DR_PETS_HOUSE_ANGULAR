import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { columnToneClasses } from './service-pricing-modal.helpers';

/**
 * PricePill — chuyển từ React: src/components/groomingSpa/ServicePricingModal.jsx
 * `wide`: ô giá dùng cho dòng chỉ có một mức giá.
 * `fullWidth`: ô giá trải hết toàn bộ vùng 5 cột khi bộ lọc là Tất cả.
 */
@Component({
  selector: 'div[app-price-pill]',
  standalone: true,
  imports: [],
  templateUrl: './price-pill.component.html',
  styleUrl: './price-pill.component.scss',
  host: {
    '[class]': '`flex h-[44px] shrink-0 items-center justify-center rounded-[16px] border bg-white px-2 text-center ${wide() ? (fullWidth() ? "w-[854px]" : "w-[420px]") : "w-[150px]"} ${columnToneClasses[tone()]}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricePillComponent {
  // --- Input / Output (props của React) ---
  readonly value = input<any>(undefined);
  readonly tone = input<any>(undefined);
  readonly wide = input<boolean>(false);
  readonly fullWidth = input<boolean>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly columnToneClasses: any = columnToneClasses;

  // --- Giá trị tính toán (computed) ---
  readonly isContact = computed<any>(() => this.value() === 'Liên hệ');

}
