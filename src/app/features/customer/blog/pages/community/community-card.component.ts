import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AuthorComponent } from './author.component';
import { TypeBadgeComponent } from './type-badge.component';
import { ActionsComponent } from './actions.component';

/**
 * CommunityCard — chuyển từ React: src/pages/Blog/CommunityPage.jsx
 */
@Component({
  selector: 'article[app-community-card]',
  standalone: true,
  imports: [AuthorComponent, TypeBadgeComponent, ActionsComponent],
  templateUrl: './community-card.component.html',
  styleUrl: './community-card.component.scss',
  host: {
    'role': 'button',
    'tabindex': '0',
    '(click)': 'onOpen.emit($event)',
    '(keydown)': '$any($event).key === \'Enter\' && onOpen.emit(undefined)',
    'class': 'cursor-pointer overflow-hidden rounded-[24px] border border-[#EEE] shadow-sm transition-transform hover:-translate-y-0.5 bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityCardComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);
  readonly state = input<any>(undefined);
  readonly onOpen = output<any>();
  readonly onLike = output<any>();
  readonly onComment = output<any>();
  readonly onShare = output<any>();

}
