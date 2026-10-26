import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * CustomerLoading — chuyển từ React: src/components/Loading/Loading.jsx (component Loading)
 */
@Component({
  selector: 'app-customer-loading',
  standalone: true,
  imports: [],
  templateUrl: './customer-loading.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerLoadingComponent {
  // --- Input / Output (props của React) ---
  readonly size = input<any>('medium');
  readonly fullScreen = input<any>(false);

  // --- Giá trị tính toán (computed) ---
  readonly sizeStyles = computed<any>(() => ({
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
  }));

}
