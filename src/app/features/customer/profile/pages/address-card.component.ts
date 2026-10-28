import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { formatAddressLine } from './user-profile-page.helpers';

/**
 * AddressCard — chuyển từ React: src/pages/User/UserProfilePage.jsx
 */
@Component({
  selector: 'article[app-address-card]',
  standalone: true,
  imports: [],
  templateUrl: './address-card.component.html',
  host: {
    '[class]': '`rounded-lg border p-[17px] text-base ${ address().isDefault ? \'border-[rgba(25,118,210,0.5)] bg-[rgba(25,118,210,0.04)]\' : \'border-[#c1c6d5] bg-white\' }`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressCardComponent {
  // --- Input / Output (props của React) ---
  readonly address = input<any>(undefined);
  readonly onEdit = output<any>();
  readonly onDelete = output<any>();
  readonly onSetDefault = output<any>();

  // --- Giá trị tính toán (computed) ---
  readonly recipient = computed<any>(() => this.address().name ?? this.address().recipient);
  readonly addressLine = computed<any>(() => formatAddressLine(this.address()));

}
