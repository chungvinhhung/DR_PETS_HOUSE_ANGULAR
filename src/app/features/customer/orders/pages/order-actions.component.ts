import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { OrderPagesYellowButtonComponent } from './order-pages-yellow-button.component';
import { OutlineButtonComponent } from './outline-button.component';

/**
 * OrderActions — chuyển từ React: src/pages/Order/OrderPages.jsx
 */
@Component({
  selector: 'app-order-actions',
  standalone: true,
  imports: [OrderPagesYellowButtonComponent, OutlineButtonComponent],
  templateUrl: './order-actions.component.html',
  styleUrl: './order-actions.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderActionsComponent {
  // --- Input / Output (props của React) ---
  readonly order = input<any>(undefined);
  readonly onNavigate = output<any>();
  readonly onRepay = output<any>();
  readonly onCancel = output<any>();
  readonly onReview = output<any>();
  readonly onReorder = output<any>();
  readonly isActionLoading = input<any>(undefined);
  readonly paymentExpired = input<any>(false);

  /** Dùng output "onRepay" như một hàm callback (React truyền thẳng prop onRepay) */
  protected readonly onRepayFn = (...args: any[]): void => this.onRepay.emit(args.length > 1 ? args : args[0]);
  /** Dùng output "onNavigate" như một hàm callback (React truyền thẳng prop onNavigate) */
  protected readonly onNavigateFn = (...args: any[]): void => this.onNavigate.emit(args.length > 1 ? args : args[0]);
  /** Dùng output "onCancel" như một hàm callback (React truyền thẳng prop onCancel) */
  protected readonly onCancelFn = (...args: any[]): void => this.onCancel.emit(args.length > 1 ? args : args[0]);
  /** Dùng output "onReview" như một hàm callback (React truyền thẳng prop onReview) */
  protected readonly onReviewFn = (...args: any[]): void => this.onReview.emit(args.length > 1 ? args : args[0]);
  /** Dùng output "onReorder" như một hàm callback (React truyền thẳng prop onReorder) */
  protected readonly onReorderFn = (...args: any[]): void => this.onReorder.emit(args.length > 1 ? args : args[0]);

  protected stopAndRun(callback: any) {
    return (event: any) => {
    event.stopPropagation();
    callback?.();
  };
  }
}
