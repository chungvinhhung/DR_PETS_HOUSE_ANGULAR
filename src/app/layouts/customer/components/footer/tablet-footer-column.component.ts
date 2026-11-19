import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TabletFooterLinkComponent } from './tablet-footer-link.component';

/**
 * TabletFooterColumn — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'section[app-tablet-footer-column]',
  standalone: true,
  imports: [TabletFooterLinkComponent],
  templateUrl: './tablet-footer-column.component.html',
  styleUrl: './tablet-footer-column.component.scss',
  host: {
    'class': 'w-full min-w-0 max-w-[328px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabletFooterColumnComponent {
  // --- Input / Output (props của React) ---
  readonly title = input<any>(undefined);
  readonly links = input<any>(undefined);
  readonly onPricingOpen = output<any>();

}
