import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';

/**
 * Actions — chuyển từ React: src/pages/Blog/CommunityPage.jsx
 */
@Component({
  selector: 'div[app-actions]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './actions.component.html',
  styleUrl: './actions.component.scss',
  host: {
    'class': 'flex items-center justify-between border-t border-[#F3F3F3] pt-4 text-[#414753]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionsComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);
  readonly liked = input<any>(undefined);
  readonly onLike = output<any>();
  readonly onComment = output<any>();
  readonly onShare = output<any>();

  /** Dùng output "onLike" như một hàm callback (React truyền thẳng prop onLike) */
  protected readonly onLikeFn = (...args: any[]): void => this.onLike.emit(args.length > 1 ? args : args[0]);
  /** Dùng output "onComment" như một hàm callback (React truyền thẳng prop onComment) */
  protected readonly onCommentFn = (...args: any[]): void => this.onComment.emit(args.length > 1 ? args : args[0]);
  /** Dùng output "onShare" như một hàm callback (React truyền thẳng prop onShare) */
  protected readonly onShareFn = (...args: any[]): void => this.onShare.emit(args.length > 1 ? args : args[0]);

  protected action(handler: any) {
    return (event: any) => {
    event.stopPropagation();
    handler();
  };
  }
}
