import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryItemDto, InventoryTransactionDto } from '../services/admin-inventory.service';

/** Read-only, shared Order/Return inventory-detail drawer.
 * Each persisted row is shown independently; BE has not exposed a stable
 * transaction-group code, so the UI never invents a TXK/PNK group ID.
 */
@Component({
  selector: 'app-admin-inventory-transaction-drawer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-inventory-transaction-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminInventoryTransactionDrawerComponent {
  @Input({required:true}) transactions: readonly InventoryTransactionDto[] = [];
  @Input() items: readonly InventoryItemDto[] = [];
  @Input() branch = '';
  @Input() reference = '';
  @Input() referenceLink = '';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closed.emit(); }

  itemFor(id: string): InventoryItemDto | undefined {
    return this.items.find(item => item.id === id);
  }
  transactionName(): string {
    const type = this.transactions[0]?.transactionType;
    return ({ISSUE:'Xuất kho',RECEIPT:'Nhập kho',TRANSFER:'Chuyển kho',
      ADJUSTMENT:'Điều chỉnh'} as Record<string,string>)[type || ''] ?? 'Giao dịch kho';
  }
  displayTime(value: string): string {
    const date=new Date(value);
    return Number.isNaN(date.getTime()) ? '—' :
      new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',
        day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',
      }).format(date);
  }
  displayReason(reason: string): string {
    if (/^Order checkout$/i.test(reason)) return 'Xuất kho theo đơn hàng';
    if (/^Restock approved return /i.test(reason)) return 'Nhập lại hàng trả được duyệt';
    return reason || '—';
  }
  signedQuantity(value: number): string {
    return (value > 0 ? '+' : '') + String(value);
  }
}
