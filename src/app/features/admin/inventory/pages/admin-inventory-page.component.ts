import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type StockKind = 'Hàng bán' | 'Vật tư dịch vụ' | 'Dùng chung';
type DialogKind = 'receipt' | 'issue' | 'adjustment' | 'transfer' | 'threshold';
interface StockItem {
  id: string; name: string; variant: string; sku: string; kind: StockKind;
  branch: string; quantity: number; threshold: number;
}
interface StockHistory {
  date: string; item: string; sku: string; branch: string; action: string;
  reason: string; delta: string; after: string; reference: string; actor: string;
}
const SAMPLE_STOCK: StockItem[] = [
  {id:'1',name:'Thức ăn Royal Canin Mini Adult',variant:'Gói 2 kg',sku:'RC-MINI-2KG',kind:'Hàng bán',branch:'Chi nhánh Quận 1',quantity:46,threshold:10},
  {id:'2',name:'Thức ăn Royal Canin Mini Adult',variant:'Gói 2 kg',sku:'RC-MINI-2KG',kind:'Hàng bán',branch:'Chi nhánh Quận 3',quantity:5,threshold:8},
  {id:'3',name:'Sữa tắm thú cưng',variant:'Chai 500 ml',sku:'ST-500ML',kind:'Hàng bán',branch:'Chi nhánh Quận 1',quantity:23,threshold:10},
  {id:'4',name:'Vaccine phòng bệnh',variant:'Liều',sku:'VC-001',kind:'Vật tư dịch vụ',branch:'Chi nhánh Quận 1',quantity:18,threshold:5},
  {id:'5',name:'Băng gạc y tế',variant:'Gói',sku:'BG-001',kind:'Vật tư dịch vụ',branch:'Chi nhánh Quận 3',quantity:0,threshold:8},
  {id:'6',name:'Vòng cổ thú cưng',variant:'Size M',sku:'VC-M',kind:'Hàng bán',branch:'Chi nhánh Quận 3',quantity:6,threshold:5},
  {id:'7',name:'Găng tay y tế',variant:'Hộp 100 chiếc',sku:'GT-100',kind:'Dùng chung',branch:'Chi nhánh Quận 1',quantity:32,threshold:10},
];
const SAMPLE_HISTORY: StockHistory[] = [
  {date:'20/10/2026 09:30',item:'Thức ăn Royal Canin Mini Adult',sku:'RC-MINI-2KG',branch:'Chi nhánh Quận 1',action:'Nhập kho',reason:'Nhận hàng từ nhà cung cấp',delta:'+20',after:'46',reference:'NK-0001',actor:'Quản trị viên'},
  {date:'19/10/2026 14:20',item:'Sữa tắm thú cưng',sku:'ST-500ML',branch:'Chi nhánh Quận 1 → Quận 3',action:'Chuyển kho',reason:'Bổ sung hàng',delta:'-10 / +10',after:'13 / 15',reference:'CK-0002',actor:'Quản lý chi nhánh'},
  {date:'18/10/2026 11:05',item:'Vaccine phòng bệnh',sku:'VC-001',branch:'Chi nhánh Quận 1',action:'Điều chỉnh',reason:'Kiểm kê định kỳ',delta:'-2',after:'18',reference:'DC-0003',actor:'Quản trị viên'},
];

@Component({
  selector: 'app-admin-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-inventory-page.component.html',
  styleUrl: './admin-inventory-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminInventoryPageComponent {
  readonly tab = signal<'stock' | 'history'>('stock');
  readonly stock = signal<StockItem[]>(SAMPLE_STOCK);
  readonly history = signal<StockHistory[]>(SAMPLE_HISTORY);
  readonly search = signal('');
  readonly branch = signal('');
  readonly type = signal('');
  readonly status = signal('');
  readonly changeType = signal('');
  readonly fromDate = signal(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
  readonly page = signal(1);
  readonly modal = signal<DialogKind | null>(null);
  readonly activeItem = signal<StockItem | null>(null);
  readonly menuId = signal<string | null>(null);
  readonly toast = signal<{message: string; tone: 'success' | 'error' | 'info'} | null>(null);
  readonly sending = signal(false);
  readonly quantity = signal<number | null>(null);
  readonly threshold = signal<number | null>(null);
  readonly destination = signal('');
  readonly note = signal('');
  readonly branches = ['Chi nhánh Quận 1', 'Chi nhánh Quận 3'];
  readonly pageSize = 7;
  readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));
  readonly stockFiltered = computed(() => this.stock().filter(row => {
    const text = this.search().trim().toLocaleLowerCase('vi');
    const matched = !text || `${row.name} ${row.variant} ${row.sku}`.toLocaleLowerCase('vi').includes(text);
    return matched && (!this.branch() || row.branch === this.branch()) &&
      (!this.type() || row.kind === this.type()) &&
      (!this.status() || this.stockStatus(row) === this.status());
  }));
  readonly historyFiltered = computed(() => this.history().filter(row => {
    const text = this.search().trim().toLocaleLowerCase('vi');
    return (!text || `${row.item} ${row.sku}`.toLocaleLowerCase('vi').includes(text)) &&
      (!this.branch() || row.branch.includes(this.branch().replace('Chi nhánh ',''))) &&
      (!this.changeType() || row.action === this.changeType()) &&
      (!this.fromDate() || new Date(row.date.slice(6,10)+'-'+row.date.slice(3,5)+'-'+row.date.slice(0,2)) >= new Date(this.fromDate()));
  }));
  readonly currentRows = computed(() => this.stockFiltered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  readonly currentHistory = computed(() => this.historyFiltered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  readonly totalPages = computed(() => Math.max(1, Math.ceil((this.tab()==='stock' ? this.stockFiltered().length : this.historyFiltered().length) / this.pageSize)));
  readonly currentQuantity = computed(() => this.activeItem()?.quantity ?? 0);
  readonly preview = computed(() => {
    const amount = this.quantity() ?? 0;
    if (this.modal() === 'receipt') return this.currentQuantity() + amount;
    if (this.modal() === 'issue') return this.currentQuantity() - amount;
    if (this.modal() === 'adjustment') return amount;
    if (this.modal() === 'transfer') return this.currentQuantity() - amount;
    return this.currentQuantity();
  });
  readonly destinationStock = computed(() => {
    const item = this.activeItem();
    return item ? (this.stock().find(row => row.sku === item.sku && row.branch === this.destination())?.quantity ?? 0) : 0;
  });
  readonly dialogTitle = computed(() => ({
    receipt:'Nhập kho',issue:'Xuất kho',adjustment:'Điều chỉnh tồn kho',transfer:'Chuyển kho',threshold:'Cài ngưỡng'
  }[this.modal() ?? 'receipt']));
  switchTab(tab: 'stock' | 'history'): void {this.tab.set(tab);this.page.set(1);this.search.set('');this.branch.set('');this.status.set('');this.type.set('');this.changeType.set('');this.menuId.set(null);}
  stockStatus(item: StockItem): string {return item.quantity === 0 ? 'Hết hàng' : item.quantity <= item.threshold ? 'Sắp hết hàng' : 'Còn hàng';}
  onFilter(): void {this.page.set(1);}
  openDialog(kind: DialogKind, item?: StockItem): void {
    this.menuId.set(null);
    this.activeItem.set(item ?? this.stock()[0] ?? null);
    this.modal.set(kind);
    this.quantity.set(null);
    this.threshold.set(item?.threshold ?? null);
    this.destination.set('');
    this.note.set('');
  }
  closeDialog(): void {this.modal.set(null);}
  selectItem(id: string): void {const item=this.stock().find(x=>x.id===id);if(item){this.activeItem.set(item);this.threshold.set(item.threshold);}}
  setQuantity(value: string): void {this.quantity.set(value === '' ? null : Number(value));}
  setThreshold(value: string): void {this.threshold.set(value === '' ? null : Number(value));}
  valid(): string | null {
    if (!this.activeItem()) return 'Vui lòng chọn sản phẩm.';
    if (this.modal() === 'threshold') {
      if (!Number.isInteger(this.threshold() ?? NaN) || (this.threshold() ?? -1)<0) return 'Vui lòng nhập ngưỡng cảnh báo hợp lệ.';
      if (this.threshold()===this.activeItem()?.threshold) return 'Ngưỡng mới phải khác ngưỡng hiện tại.';
    } else {
      if (!Number.isInteger(this.quantity() ?? NaN) || (this.quantity() ?? -1) < (this.modal()==='adjustment'?0:1)) return 'Vui lòng nhập số lượng hợp lệ.';
      if (['issue','transfer'].includes(this.modal()??'') && (this.quantity()??0)>this.currentQuantity()) return 'Số lượng vượt quá tồn kho hiện tại.';
      if (this.modal()==='transfer' && (!this.destination() || this.destination()===this.activeItem()?.branch)) return 'Vui lòng chọn chi nhánh nhận khác chi nhánh xuất.';
    }
    if (this.modal()!=='receipt' && !this.note().trim()) return 'Vui lòng nhập lý do.';
    if (this.modal()==='receipt' && (!Number.isInteger(this.threshold() ?? NaN) || (this.threshold()??-1)<0)) return 'Vui lòng nhập ngưỡng cảnh báo hợp lệ.';
    return null;
  }
  notify(message: string, tone: 'success'|'error'|'info'='info'): void {this.toast.set({message,tone});}
  submit(): void {
    const err=this.valid();
    if(err){this.notify(err,'error');return;}
    this.notify('Chức năng này đang được hoàn thiện. Vui lòng thử lại sau.','info');
  }
  setPage(n: number): void {this.page.set(Math.max(1,Math.min(this.totalPages(),n)));}
}
