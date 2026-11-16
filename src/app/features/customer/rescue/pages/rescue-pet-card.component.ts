import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';

/**
 * RescuePetCard — chuyển từ React: src/pages/Rescue/RescuePage.jsx
 */
@Component({
  selector: 'article[app-rescue-pet-card]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './rescue-pet-card.component.html',
  styleUrl: './rescue-pet-card.component.scss',
  host: {
    'class': 'relative flex h-[625px] w-full max-w-[380px] flex-col overflow-hidden rounded-[2px] border border-[rgba(208,198,174,0.6)] bg-[#FAF9F6] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RescuePetCardComponent {
  // --- Input / Output (props của React) ---
  readonly pet = input<any>(undefined);
  readonly onAdopt = output<any>();

  // --- Giá trị tính toán (computed) ---
  readonly adopted = computed<any>(() => this.pet().state === "adopted");

}
