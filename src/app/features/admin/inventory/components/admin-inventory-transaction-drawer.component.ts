import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryItemDto, InventoryTransactionDto } from '../services/admin-inventory.service';

/** Shared read-only inventory transaction drawer.
 * Multiple persisted SKU movements can be rendered as one business transaction
 * when the API exposes a shared code or a stable source/time correlation.
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
  @Input() transactionCode = '';
  @Input() reference = '';
  @Input() referenceLink = '';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closed.emit(); }

  itemFor(id: string): InventoryItemDto | undefined {
    return this.items.find(item => item.id === id);
  }
  movementLines(): Array<{
    key:string; inventoryItemId:string; sku:string; name:string; unit:string;
    quantity:number; beforeQty:number; changeQty:number; afterQty:number;
  }> {
    const lines: Array<{
      key:string; inventoryItemId:string; sku:string; name:string; unit:string;
      quantity:number; beforeQty:number; changeQty:number; afterQty:number;
    }> = [];
    for (const tx of this.transactions) {
      if (Array.isArray(tx.items) && tx.items.length) {
        tx.items.forEach((line,index) => {
          const item=this.itemFor(line.inventoryItemId);
          lines.push({
            key:tx.id+':'+line.inventoryItemId+':'+index,
            inventoryItemId:line.inventoryItemId,
            sku:line.sku || item?.sku || '—',
            name:line.name || item?.name || line.inventoryItemId,
            unit:line.unit || item?.unit || '',
            quantity:Number(line.quantity ?? Math.abs(line.changeQty || 0)),
            beforeQty:Number(line.beforeQty || 0),
            changeQty:Number(line.changeQty || 0),
            afterQty:Number(line.afterQty || 0),
          });
        });
      } else {
        const item=this.itemFor(tx.inventoryItemId);
        lines.push({
          key:tx.id+':'+tx.inventoryItemId,
          inventoryItemId:tx.inventoryItemId,
          sku:item?.sku || '—',
          name:item?.name || tx.inventoryItemId,
          unit:item?.unit || '',
          quantity:Math.abs(Number(tx.changeQty || 0)),
          beforeQty:Number(tx.beforeQty || 0),
          changeQty:Number(tx.changeQty || 0),
          afterQty:Number(tx.afterQty || 0),
        });
      }
    }
    return lines;
  }
  displayedTransactionCode():string {
    const tx=this.transactions[0];
    return this.transactionCode || tx?.transactionCode || tx?.groupCode || tx?.code || tx?.id || 'Chưa có mã giao dịch';
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
