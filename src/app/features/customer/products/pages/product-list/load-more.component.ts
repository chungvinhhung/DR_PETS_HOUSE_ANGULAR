import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';

/**
 * LoadMore — chuyển từ React: src/pages/Product/ProductPage.jsx
 */
@Component({
  selector: 'div[app-load-more]',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './load-more.component.html',
  host: {
    'class': 'mx-auto mt-[32px] flex h-[202px] w-full max-w-[498px] flex-col items-center gap-[26px] py-[24px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadMoreComponent {
  // --- Input / Output (props của React) ---
  readonly shown = input<any>(undefined);
  readonly total = input<any>(undefined);
  readonly hasMore = input<any>(undefined);
  readonly isLoading = input<any>(undefined);
  readonly onLoadMore = output<any>();

  // --- Giá trị tính toán (computed) ---
  readonly fromLabel = computed<any>(() => this.total() > 0 ? 1 : 0);

  /** (tự sinh) global Math không dùng trực tiếp được trong template */
  protected styles1(): any {
    return { width: `${Math.min(100, (this.shown() / Math.max(this.total(), 1)) * 100)}%` };
  }
}
