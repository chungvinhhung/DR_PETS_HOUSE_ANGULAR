import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Alert — chuyển từ React: src/components/Alert/Alert.jsx
 */
@Component({
  selector: 'div[app-alert]',
  standalone: true,
  imports: [],
  templateUrl: './alert.component.html',
  host: {
    '[class]': '`rounded-md border p-4 ${alertStyles()[type()]}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertComponent {
  // --- Input / Output (props của React) ---
  readonly type = input<any>('info');
  readonly message = input<any>(undefined);
  readonly description = input<any>(undefined);
  readonly onClose = output<any>();
  /** true khi component cha có truyền (onClose) — thay cho kiểm tra "if (onClose)" của React */
  readonly hasOnClose = input<boolean>(false);

  // --- Giá trị tính toán (computed) ---
  readonly alertStyles = computed<any>(() => ({
    info: 'bg-blue-50 border-blue-400 text-blue-800',
    success: 'bg-green-50 border-green-400 text-green-800',
    warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
    error: 'bg-red-50 border-red-400 text-red-800',
  }));
  readonly iconStyles = computed<any>(() => ({
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  }));

}
