import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { contactAssets } from '../data/contact-data';

/**
 * BranchCard — chuyển từ React: src/pages/Contact/ContactPage.jsx
 */
@Component({
  selector: 'button[app-branch-card]',
  standalone: true,
  imports: [],
  templateUrl: './branch-card.component.html',
  host: {
    'type': 'button',
    '[class]': '`contact-branch-card${active() ? \' is-active\' : \'\'}`',
    '(click)': 'onSelect.emit(branch().id)',
    '[attr.aria-pressed]': 'active()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchCardComponent {
  // --- Input / Output (props của React) ---
  readonly branch = input<any>(undefined);
  readonly active = input<any>(undefined);
  readonly onSelect = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly contactAssets: any = contactAssets;

}
