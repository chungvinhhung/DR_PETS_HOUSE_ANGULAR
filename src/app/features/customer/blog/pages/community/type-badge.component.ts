import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { POST_TYPES } from './community-page.helpers';

/**
 * TypeBadge — chuyển từ React: src/pages/Blog/CommunityPage.jsx
 */
@Component({
  selector: 'app-type-badge',
  standalone: true,
  imports: [],
  templateUrl: './type-badge.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeBadgeComponent {
  // --- Input / Output (props của React) ---
  readonly type = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly POST_TYPES: any = POST_TYPES;

}
