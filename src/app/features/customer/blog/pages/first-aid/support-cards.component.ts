import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';

/**
 * SupportCards — chuyển từ React: src/pages/Blog/FirstAidPage.jsx
 */
@Component({
  selector: 'div[app-support-cards]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './support-cards.component.html',
  styleUrl: './support-cards.component.scss',
  host: {
    'class': 'mt-6 grid w-full grid-cols-1 gap-6 md:grid-cols-12',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportCardsComponent {
}
