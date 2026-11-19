import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';

/**
 * TabletContactRow — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'p[app-tablet-contact-row]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './tablet-contact-row.component.html',
  styleUrl: './tablet-contact-row.component.scss',
  host: {
    'class': 'flex items-start gap-2 font-[\'Roboto\'] text-[15px] font-normal leading-[1.4] text-[#20262E]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabletContactRowComponent {
  // --- Input / Output (props của React) ---
  readonly Icon = input<any>(undefined, { alias: 'icon' });

}
