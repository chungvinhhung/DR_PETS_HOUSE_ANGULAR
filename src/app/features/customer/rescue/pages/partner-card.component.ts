import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';

/**
 * PartnerCard — chuyển từ React: src/pages/Rescue/RescuePage.jsx
 */
@Component({
  selector: 'article[app-partner-card]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './partner-card.component.html',
  host: {
    'class': 'flex h-[406px] w-full max-w-[357.333px] flex-col rounded-[32px] border border-[#D9E3F6] bg-white p-px shadow-[0_10px_30px_rgba(59,130,246,0.15)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerCardComponent {
  // --- Input / Output (props của React) ---
  readonly partner = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly description = computed<any>(() => Array.isArray(this.partner().description) ? this.partner().description : [this.partner().description]);

}
