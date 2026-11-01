import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { AdminReturnNotificationService } from '../../../../shared/services/admin-return-notification.service';
import { orderErrorMessage } from '../services/admin-order-error-message';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
import { AdminInventoryService, InventoryItemDto, InventoryTransactionDto } from '../../inventory/services/admin-inventory.service';
import { AdminInventoryTransactionDrawerComponent } from '../../inventory/components/admin-inventory-transaction-drawer.component';
import { AdminProductService } from '../../products/services/admin-product.service';
import {
  AdminOrderApiService, OrderRecord, OrderReturnSummary, OrderRefundRecord, ReturnStatus,
  ReturnStaffAction, ReturnManagerAction,
} from '../services/admin-order-api.service';

type WorkflowAction = ReturnStaffAction | ReturnManagerAction | 'refund';
const RETURN_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'Chờ tiếp nhận',
  PROCESSING: 'Đang xử lý',
  RECEIVED: 'Đã nhận hàng',
  APPROVED: 'Đã duyệt hoàn',
  REJECTED: 'Đã từ chối',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};
@Component({
  selector: 'app-admin-order-return-detail',
  standalone: true,
  imports: [AdminCatalogShellComponent, RouterLink, AdminInventoryTransactionDrawerComponent],
  templateUrl: './admin-order-return-detail.component.html',
  styleUrl: './admin-order-return-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderReturnDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AdminOrderApiService);
  private readonly session = inject(AuthSessionService);
  private readonly branchApi = inject(BranchManagementApiService);
  private readonly inventoryApi = inject(AdminInventoryService);
  private readonly productApi = inject(AdminProductService);
  private readonly toast = inject(AdminToastService);
  private readonly returnNotifications = inject(AdminReturnNotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = signal('');
  readonly data = signal<OrderReturnSummary | null>(null);
  readonly linkedOrder = signal<OrderRecord | null>(null);
  readonly productThumbs = signal<Record<string,string>>({});
  readonly branchNames = signal<Record<string,string>>({});
  readonly refund = signal<OrderRefundRecord | null>(null);
  readonly relatedReceipts = signal<InventoryTransactionDto[]>([]);
  readonly relatedReceiptItems = signal<InventoryItemDto[]>([]);
  readonly relatedReceiptsLoading = signal(false);
  readonly relatedReceiptsError = signal(false);
  readonly inventoryDrawerOpen = signal(false);
  readonly selectedReceipt = signal<InventoryTransactionDto | null>(null);
  readonly selectedReceiptRows = computed(() => this.selectedReceipt() ? [this.selectedReceipt()!] : []);
  readonly selectedReceiptCode = computed(() => {
    const tx = this.selectedReceipt();
    return tx ? this.receiptCode(tx) : '';
  });
  readonly actualRestockedQty = computed(() => this.relatedReceipts().reduce((sum, tx) => sum + Math.max(0, tx.changeQty), 0));
  readonly loading = signal(true);
  readonly refundLoading = signal(false);
  readonly error = signal('');
  readonly dialog = signal<WorkflowAction | null>(null);
  readonly busy = signal(false);
  readonly note = signal('');
  readonly inspection = signal<Record<string,{receivedQty:string;restockQty:string}>>({});
  readonly inspectionValid = computed(()=>{
    const data=this.data();
    return !!data?.items.length && data.items.every(item=>{
      const row=this.inspection()[item.orderItemId];
      if(!row || row.receivedQty.trim()==='' || row.restockQty.trim()==='')return false;
      const q=Number(row.receivedQty),stock=Number(row.restockQty);
      return Number.isSafeInteger(q) && q>=0 && q<=item.requestedQty &&
        Number.isSafeInteger(stock) && stock>=0 && (stock===0 || stock===q);
    });
  });
  readonly evidencePreview = signal<string | null>(null);
  readonly statusSteps: ReturnStatus[] = ['REQUESTED', 'PROCESSING', 'RECEIVED', 'APPROVED', 'COMPLETED'];

  readonly isManager = computed(() => {
    const role = this.session.user()?.systemRole;
    return role === 'ADMIN' || role === 'MANAGER';
  });
  readonly canStaff = computed(() => {
    const u = this.session.user();
    return this.isManager() || (u?.systemRole === 'STAFF' && u.staffSubRole === 'RECEPTIONIST');
  });
  readonly availableActions = computed<WorkflowAction[]>(() => {
    const r = this.data();
    if (!r) return [];
    if (r.status === 'REQUESTED' && this.canStaff()) return ['process'];
    if (r.status === 'PROCESSING') return [
      ...(this.isManager() ? ['reject' as WorkflowAction] : []),
      ...(this.canStaff() ? ['receive' as WorkflowAction] : []),
    ];
    if (r.status === 'RECEIVED' && this.isManager()) return ['reject','approve'];
    if (r.status === 'APPROVED' && this.isManager() && r.refundId && this.refund()?.status === 'PENDING') return ['refund'];
    return [];
  });
  readonly totalQuantity = computed(() => this.data()?.items.reduce((sum, item) => sum + item.requestedQty, 0) ?? 0);
  /** Identify the stage after which an irreversible rejection/cancellation occurred. */
  rejectionStage(ret:OrderReturnSummary):ReturnStatus {
    if(ret.history?.some(event=>event.status==='RECEIVED') ||
       ret.items.some(item=>typeof item.receivedQty==='number'))return 'RECEIVED';
    if(ret.status==='CANCELLED' && !ret.history?.some(event=>event.status==='PROCESSING'))
      return 'REQUESTED';
    return 'PROCESSING';
  }
  terminalStageLabel(ret:OrderReturnSummary):string {
    return this.label(this.rejectionStage(ret)).toLowerCase();
  }
  isStepReached(ret: OrderReturnSummary, step: ReturnStatus): boolean {
    if (ret.status === 'REJECTED' || ret.status === 'CANCELLED') {
      return this.statusSteps.indexOf(step)<=this.statusSteps.indexOf(this.rejectionStage(ret));
    }
    return this.statusSteps.indexOf(ret.status) >= this.statusSteps.indexOf(step);
  }
  readonly returnHistory = computed(() => [...(this.data()?.history ?? [])]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()));

  requestSubmittedAt(ret: OrderReturnSummary): string | undefined {
    return ret.history?.find(event => event.status === 'REQUESTED')?.at ?? ret.createdAt;
  }
  progressLabel(ret: OrderReturnSummary, step: ReturnStatus): string {
    const at = ret.history?.find(event => event.status === step)?.at;
    if (at) {
      const date = new Date(at);
      return Number.isNaN(date.getTime()) ? 'BE chưa ghi thời gian' :
        new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
        }).format(date);
    }
    const reached = this.isStepReached(ret,step);
    return reached ? 'Chưa ghi thời gian' : 'Chưa bắt đầu';
  }
  availableReturnQty(item: OrderReturnSummary['items'][number]): number {
    return Math.max(0, item.orderedQty - item.alreadyReturnedQty);
  }
  /**
   * Badge "Hoàn X/Y": X = quantity refunded by this return, Y = requestedQty.
   * This backend settles the entire approved request at COMPLETED (it has no
   * partial-refund quantity action). Use approvedQty if a newer API supplies
   * it; otherwise a completed return has refunded its full requestedQty.
   * Never use orderedQty or alreadyReturnedQty as the denominator.
   */
  refundedQuantity(ret: OrderReturnSummary, item: OrderReturnSummary['items'][number]): number {
    if (ret.status !== 'COMPLETED') return 0;
    const approved = item.approvedQty;
    const quantity = typeof approved === 'number' && Number.isFinite(approved)
      ? approved : item.requestedQty;
    return Math.max(0, Math.min(quantity, item.requestedQty));
  }
  hasNonResellable(ret: OrderReturnSummary):boolean{
    return ret.items.some(item=>item.quality==='DAMAGED'||item.quality==='DISCARDED');
  }
  receivedTotal(ret: OrderReturnSummary): string {
    if (!['RECEIVED','APPROVED','COMPLETED'].includes(ret.status))return 'Chưa kiểm hàng';
    if (!ret.items.length || ret.items.some(item => typeof item.receivedQty !== 'number')) return 'Chưa có dữ liệu';
    return ret.items.reduce((total, item) => total + (item.receivedQty ?? 0), 0) + ' sản phẩm';
  }

  constructor() {
    this.branchApi.listBranches().pipe(takeUntilDestroyed()).subscribe({
      next: branches => this.branchNames.set(Object.fromEntries(branches.map(branch => [branch.id, branch.name]))),
      error: () => { /* A branch name is noncritical; display the ID instead. */ },
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const id = params.get('id') ?? '';
      this.id.set(id);
      this.data.set(null);
      this.linkedOrder.set(null);
      this.productThumbs.set({});
      this.refund.set(null);
      this.relatedReceipts.set([]);
      this.relatedReceiptItems.set([]);
      this.closeInventoryDrawer();
      this.dialog.set(null);
      this.load();
    });
  }
  load(): void {
    const id = this.id();
    if (!id) { this.loading.set(false); this.error.set('Thiếu mã yêu cầu trả hàng.'); return; }
    this.loading.set(true); this.error.set('');
    this.api.getReturn(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => {
        if (this.id() !== id) return;
        this.data.set(value);
        this.loadLinkedOrder(value.id, value.orderId);
        this.loading.set(false);
        this.refreshRefund(value);
        this.loadRelatedReceipts(value);
      },
      error: err => {
        if (this.id() !== id) return;
        this.data.set(null); this.loading.set(false);
        this.error.set(orderErrorMessage(err, 'Không tải được chi tiết yêu cầu trả hàng.'));
      },
    });
  }
  private loadRelatedReceipts(ret: OrderReturnSummary): void {
    // BE tags return restocks as ORDER receipts, with the return ID in reason.
    // Only render persisted entries actually referencing this return.
    this.relatedReceipts.set([]);
    this.relatedReceiptItems.set([]);
    this.relatedReceiptsLoading.set(true);
    this.relatedReceiptsError.set(false);
    const returnId = ret.id;
    forkJoin({
      transactions: this.inventoryApi.listTransactions(),
      items: this.inventoryApi.listItems(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({transactions, items}) => {
        if (this.id() !== returnId) return;
        this.relatedReceiptItems.set(items);
        this.relatedReceipts.set(transactions.filter(tx =>
          tx.transactionType === 'RECEIPT' &&
          tx.sourceType?.toUpperCase() === 'ORDER' &&
          tx.sourceId === ret.orderId &&
          tx.reason?.includes(returnId),
        ));
        this.relatedReceiptsLoading.set(false);
      },
      error: () => {
        if (this.id() !== returnId) return;
        this.relatedReceiptsError.set(true);
        this.relatedReceiptsLoading.set(false);
      },
    });
  }

  receiptCode(tx: InventoryTransactionDto): string {
    return tx.transactionCode || tx.groupCode || tx.code || tx.id;
  }
  openReceipt(tx: InventoryTransactionDto): void {
    this.selectedReceipt.set(tx);
    this.inventoryDrawerOpen.set(true);
  }
  closeInventoryDrawer(): void {
    this.inventoryDrawerOpen.set(false);
    this.selectedReceipt.set(null);
  }
  restockedLabel(): string {
    if (this.relatedReceiptsLoading()) return 'Đang tải...';
    if (this.relatedReceiptsError()) return 'Không thể tải';
    if (!this.relatedReceipts().length) return '0 sản phẩm';
    return this.actualRestockedQty() + ' sản phẩm';
  }
  receiptStateLabel(): string {
    if (this.relatedReceiptsLoading()) return 'Đang tải...';
    if (this.relatedReceiptsError()) return 'Không thể tải';
    return 'Không phát sinh';
  }

  private loadLinkedOrder(returnId: string, orderId: string): void {
    this.linkedOrder.set(null);
    this.api.get(orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: order => {
        if (this.data()?.id === returnId) {
          this.linkedOrder.set(order);
          this.loadProductImages(order, returnId);
        }
      },
      error: () => {
        // Display a clear placeholder when the order is not available in this role.
        if (this.data()?.id === returnId) this.linkedOrder.set(null);
      },
    });
  }
  private loadProductImages(order: OrderRecord, returnId: string): void {
    const ids = [...new Set(order.items.map(item => item.productId).filter(Boolean))];
    if (!ids.length) return;
    forkJoin(ids.map(id => this.productApi.getProduct(id).pipe(
      map(product => [id, product.images.find(img => img.isPrimary)?.url
        || product.images[0]?.url || ''] as const),
      catchError(() => of([id, ''] as const)),
    ))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(rows => {
      if (this.data()?.id !== returnId) return;
      this.productThumbs.set(Object.fromEntries(rows));
    });
  }

  productImage(orderItemId: string): string {
    const item = this.linkedOrder()?.items.find(row => row.orderItemId === orderItemId);
    return item ? this.productThumbs()[item.productId] || '' : '';
  }

  branchName(id?: string | null): string {
    if (!id) return 'Chưa có dữ liệu';
    return this.branchNames()[id] || id;
  }
  orderSku(orderItemId: string): string {
    return this.linkedOrder()?.items.find(item => item.orderItemId === orderItemId)?.skuSnapshot || '—';
  }
  private refreshRefund(data: OrderReturnSummary): void {
    if (!data.refundId || !this.isManager()) { this.refund.set(null); return; }
    this.refundLoading.set(true);
    this.api.getRefund(data.refundId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => {
        if (this.id() === data.id) this.refund.set(value);
        this.refundLoading.set(false);
      },
      error: err => {
        if (this.id() === data.id) this.toast.show(orderErrorMessage(err, 'Không đọc được trạng thái giao dịch hoàn tiền.'), 'error');
        this.refundLoading.set(false);
      },
    });
  }
  label(status: ReturnStatus | string): string { return RETURN_LABELS[status as ReturnStatus] ?? status; }
  finalRefundAmount(): number | null {
    const ret = this.data();
    if (!ret || ret.status !== 'COMPLETED') return null;
    // Read settled refund amount when available, falling back to this BE's
    // approved amount only because processOrderRefund settles that exact value.
    const settled = this.refund();
    const amount = settled?.status === 'REFUNDED'
      ? settled.amount : (ret.finalRefundAmount ?? ret.refundBreakdown?.total);
    return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
      ? amount : null;
  }
  /** Preserve the value of the original request after BE overwrites the
   * aggregate refundBreakdown.total on manager approval. Individual item
   * refundAmount is immutable for the originally requested quantity. */
  requestedRefundAmount(ret: OrderReturnSummary): number {
    return ret.items.reduce((sum,item) => sum + (Number(item.refundAmount) || 0), 0)
      + (Number(ret.refundBreakdown.shippingRefunded) || 0);
  }

  /** Before approval this is a projection based on received quantities.
   * After approval the BE's authoritative adjusted total takes precedence. */
  expectedRefundAmount(ret: OrderReturnSummary): number {
    if (ret.status === 'APPROVED' || ret.status === 'COMPLETED') {
      return ret.refundBreakdown.total;
    }
    if (ret.items.some(item => typeof item.receivedQty === 'number')) {
      return this.approvedPreviewAmount();
    }
    return this.requestedRefundAmount(ret);
  }

  money(value?: number | null): string {
    return typeof value === 'number' && Number.isFinite(value)
      ? new Intl.NumberFormat('vi-VN').format(value) + 'đ' : '—';
  }
  when(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(d);
  }
  actionName(action: WorkflowAction): string {
    if (action === 'reject') return this.data()?.status === 'RECEIVED' ? 'Từ chối hoàn tiền' : 'Từ chối';
    return ({ process: 'Tiếp nhận xử lý', receive: 'Xác nhận nhận hàng',
      approve: 'Phê duyệt hoàn tiền', refund: 'Xác nhận hoàn tiền' } as const)[action];
  }
  approvedQuantity():number {
    return (this.data()?.items??[]).reduce((sum,item)=>sum+(item.receivedQty??item.requestedQty),0);
  }
  approvedPreviewAmount():number {
    return (this.data()?.items??[]).reduce((sum,item)=>{
      const quantity=item.receivedQty??item.requestedQty;
      return sum+Math.round((item.refundAmount/(item.requestedQty||1))*quantity);
    },0);
  }
  returnDialogTitle(action:WorkflowAction):string {
    if(action==='reject')return this.data()?.status==='RECEIVED'
      ? 'Từ chối phê duyệt hoàn tiền':'Từ chối yêu cầu trả hàng';
    if(action==='approve')return 'Phê duyệt hoàn tiền';
    if(action==='receive')return 'Xác nhận nhận hàng';
    if(action==='process')return 'Tiếp nhận xử lý yêu cầu';
    return 'Xác nhận hoàn tiền';
  }
  readonly todayLocal = new Intl.DateTimeFormat('vi-VN',{
    timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',
  }).format(new Date());
  receiveQuantity(id:string):number {
    const raw=this.inspection()[id]?.receivedQty;
    return raw!==undefined && raw!=='' && Number.isFinite(Number(raw))?Number(raw):0;
  }
  totalReceivedPreview():number {
    return (this.data()?.items||[]).reduce((sum,item)=>sum+this.receiveQuantity(item.orderItemId),0);
  }
  restockQuantity(id:string):number {
    const raw=this.inspection()[id]?.restockQty;
    return raw!==undefined && raw!=='' && Number.isFinite(Number(raw))?Number(raw):0;
  }
  restockPreview():number {
    return (this.data()?.items||[]).reduce((sum,item)=>sum+this.restockQuantity(item.orderItemId),0);
  }
  stepRestock(id:string,delta:number):void {
    const max=this.receiveQuantity(id);
    const next=Math.min(max,Math.max(0,this.restockQuantity(id)+delta));
    this.editInspection(id,'restockQty',String(next));
  }
  stepReceive(id:string,delta:number,max:number):void {
    const next=Math.min(max,Math.max(0,this.receiveQuantity(id)+delta));
    this.editInspection(id,'receivedQty',String(next));
  }
  modalSubtitle(action:WorkflowAction):string {
    const r=this.data();if(!r)return '';
    const code=r.code||r.id;
    if(action==='receive')return code+' | '+r.items.length+' sản phẩm cần kiểm tra';
    if(action==='approve')return code+' · '+r.items.map(i=>i.productName).join(', ')+' · Đã nhận '+this.approvedQuantity();
    return code+' · '+this.label(r.status);
  }
  actionExplanation(action: WorkflowAction): string {
    return ({
      process: 'Yêu cầu chuyển sang Đang xử lý. Chưa tiếp nhận hàng thực tế.',
      receive: 'Đối chiếu số lượng và tình trạng sản phẩm thực nhận trước khi xác nhận.',
      approve: 'Kiểm tra lại số lượng thực nhận và số tiền hoàn trước khi phê duyệt.',
      reject: 'Lý do từ chối phải được ghi nhận trước khi hoàn tất.',
      refund: 'Backend chưa hỗ trợ chuyển khoản hoàn tiền thực tế. Xác nhận hiện chỉ ghi nhận trạng thái giao dịch.',
    })[action];
  }
  open(action: WorkflowAction): void {
    if (!this.availableActions().includes(action) || this.busy()) return;
    this.note.set('');
    this.inspection.set(action==='receive'
      ? Object.fromEntries((this.data()?.items||[]).map(item=>[
          item.orderItemId,{receivedQty:String(item.requestedQty),restockQty:''}
        ]))
      : {});
    this.dialog.set(action);
  }
  close(): void { if (!this.busy()) this.dialog.set(null); }
  editInspection(id:string,field:'receivedQty'|'restockQty',value:string):void{
    this.inspection.update(all=>{
      const previous=all[id]??{receivedQty:'',restockQty:''};
      const next={...previous,[field]:value};
      // A quantity reduction must not silently authorize restocking more units.
      if(field==='receivedQty' && previous.restockQty!=='' && Number(previous.restockQty)>Number(value)){
        next.restockQty='';
      }
      return {...all,[id]:next};
    });
  }
  submit(): void {
    const action = this.dialog(), data = this.data();
    if (!action || !data || this.busy() || !this.availableActions().includes(action)) return;
    if (action === 'reject' && this.note().trim().length < 5) return;
    if(action==='receive' && !this.inspectionValid()){
      this.toast.show('Kiểm tra số lượng thực nhận và chọn số lượng nhập kho (0 hoặc toàn bộ) cho từng sản phẩm.');return;
    }
    this.busy.set(true);
    const request: Observable<unknown> = action === 'refund'
      ? this.api.processRefund(data.refundId!, 'order-refund-' + data.refundId)
      : action === 'approve' || action === 'reject'
        ? this.api.returnManagerAction(data.id, action as ReturnManagerAction,
          action === 'approve' ? { note: this.note().trim() } : { reason: this.note().trim() })
        : this.api.returnStaffAction(data.id, action as ReturnStaffAction,
          action==='receive' ? {items:data.items.map(item=>({
            orderItemId:item.orderItemId,
            receivedQty:Number(this.inspection()[item.orderItemId].receivedQty),
            quality:(this.restockQuantity(item.orderItemId)===this.receiveQuantity(item.orderItemId) &&
              this.receiveQuantity(item.orderItemId)>0 ? 'RESELLABLE' : 'DAMAGED') as 'RESELLABLE'|'DAMAGED',
          })),note:this.note().trim()||undefined} : undefined);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false); this.dialog.set(null);
        this.toast.show('Đã cập nhật yêu cầu trả hàng thành công.', 'success');
        this.returnNotifications.refresh();
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.toast.show(orderErrorMessage(err, 'Không thể xử lý yêu cầu. Vui lòng kiểm tra trạng thái mới nhất.'), 'error');
        this.load();
      },
    });
  }
  isEvidenceUrl(url: string): boolean {
    try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:'; }
    catch { return false; }
  }
  showEvidence(url: string): void { if (this.isEvidenceUrl(url)) this.evidencePreview.set(url); }
  closeEvidence(): void { this.evidencePreview.set(null); }
}
