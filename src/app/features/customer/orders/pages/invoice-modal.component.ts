import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { formatCurrency, formatOrderDate, getOrderSubtotal, getOrderTotal } from '../data/order-data';

/**
 * InvoiceModal — chuyển từ React: src/pages/Order/OrderPages.jsx
 */
@Component({
  selector: 'div[app-invoice-modal]',
  standalone: true,
  imports: [],
  templateUrl: './invoice-modal.component.html',
  host: {
    'class': 'fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-5 backdrop-blur-sm',
    '(click)': 'onClose.emit($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceModalComponent {
  // --- Input / Output (props của React) ---
  readonly order = input<any>(undefined);
  readonly onClose = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly formatOrderDate: any = formatOrderDate;
  protected readonly formatCurrency: any = formatCurrency;
  protected readonly getOrderSubtotal: any = getOrderSubtotal;
  protected readonly getOrderTotal: any = getOrderTotal;

  protected downloadInvoice() {
    window.print();
  }
}
