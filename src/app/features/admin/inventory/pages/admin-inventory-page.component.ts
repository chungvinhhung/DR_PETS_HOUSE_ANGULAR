import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable, finalize, switchMap, tap } from 'rxjs';
import { AdminProduct } from '../../products/models/admin-product.model';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import {
  AdminInventoryService,
  InventoryBranchDto,
  InventoryItemDto,
  InventoryStockDto,
  InventoryTransactionDto,
  InventoryMovementWrite,
} from '../services/admin-inventory.service';

type StockKind = 'Hàng bán' | 'Vật tư dịch vụ' | 'Dùng chung';
type DialogKind = 'receipt' | 'issue' | 'adjustment' | 'transfer' | 'threshold';
interface StockItem {
  id: string;
  itemId: string;
  branchId: string;
  version: number;
  name: string;
  variant: string;
  sku: string;
  kind: StockKind;
  branch: string;
  quantity: number;
  threshold: number | null;
}
interface StockHistory {
  id: string;
  date: string;
  item: string;
  sku: string;
  variant: string;
  branch: string;
  branchId: string;
  action: string;
  reason: string;
  delta: string;
  after: string;
  reference: string;
  actor: string;
}

@Component({
  selector: 'app-admin-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminCatalogShellComponent],
  templateUrl: './admin-inventory-page.component.html',
  styleUrl: './admin-inventory-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminInventoryPageComponent implements OnInit {
  private readonly adminToast = inject(AdminToastService);
  private readonly inventoryApi = inject(AdminInventoryService);
  private readonly auth = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly tab = signal<'stock' | 'history'>('stock');
  readonly stock = signal<StockItem[]>([]);
  readonly history = signal<StockHistory[]>([]);
  readonly inventoryItems = signal<InventoryItemDto[]>([]);
  readonly catalogProducts = signal<AdminProduct[]>([]);
  readonly scopedBranchIds = signal<string[]>([]);
  readonly catalogBySku = computed(() => {
    const bySku = new Map<string, { name: string; label: string; usage: StockKind; hasVariant: boolean }>();
    for (const product of this.catalogProducts()) {
      for (const variant of product.variants) {
        bySku.set(variant.sku.trim().toLowerCase(), {
          name: product.name,
          label: variant.label,
          usage: product.usageType === 'SHARED' ? 'Dùng chung'
            : product.usageType === 'SERVICE_SUPPLY' ? 'Vật tư dịch vụ' : 'Hàng bán',
          hasVariant: product.productType === 'VARIANT',
        });
      }
    }
    return bySku;
  });
  readonly branchesData = signal<InventoryBranchDto[]>([]);
  readonly search = signal('');
  readonly branch = signal('');
  readonly type = signal('');
  readonly status = signal('');
  readonly changeType = signal('');
  readonly fromDate = signal(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  readonly page = signal(1);
  readonly modal = signal<DialogKind | null>(null);
  readonly activeItem = signal<StockItem | null>(null);
  readonly menuId = signal<string | null>(null);
  readonly sending = signal(false);
  readonly quantity = signal<number | null>(null);
  readonly threshold = signal<number | null>(null);
  readonly destination = signal('');
  readonly receiptBranch = signal('');
  readonly receiptSku = signal('');
  readonly note = signal('');
  private writeKey = '';

  readonly branches = computed(() => {
    const accessibleIds = new Set(this.scopedBranchIds());
    const isAdmin = this.auth.hasAnyRole(['ADMIN']);
    return this.branchesData()
      .filter(b => b.status === 'ACTIVE' && (isAdmin || accessibleIds.has(b.id)))
      .map(b => b.name);
  });
  readonly pageSize = 7;
  readonly productOptions = computed(() => {
    const catalog = this.catalogBySku();
    return this.inventoryItems().filter(item =>
      item.status === 'ACTIVE' && (item.kind === 'MATERIAL' || catalog.has(item.sku.trim().toLowerCase())),
    );
  });
  readonly receiptStock = computed(() => {
    const selected = this.activeItem();
    return selected ? this.stock().find(item => item.itemId === selected.itemId && item.branch === this.receiptBranch()) ?? null : null;
  });
  readonly destinationItem = computed(() => {
    const selected = this.activeItem();
    return selected ? this.stock().find(item => item.itemId === selected.itemId && item.branch === this.destination()) ?? null : null;
  });
  readonly destinationNeedsThreshold = computed(() => !!this.destination() && this.destinationItem()?.threshold == null);
  readonly destinationLabel = computed(() => this.shortBranch(this.destination()));
  readonly effectiveThreshold = computed(() => this.modal() === 'receipt' ? this.receiptStock()?.threshold ?? null : this.activeItem()?.threshold ?? null);
  readonly stockFiltered = computed(() => this.stock().filter(row => {
    const search = this.search().trim().toLocaleLowerCase('vi');
    return (!search || `${row.name} ${row.sku} ${row.variant}`.toLocaleLowerCase('vi').includes(search)) &&
      (!this.branch() || row.branch === this.branch()) &&
      (!this.type() || row.kind === this.type()) &&
      (!this.status() || this.stockStatus(row) === this.status());
  }));
  readonly historyFiltered = computed(() => this.history().filter(row => {
    const search = this.search().trim().toLocaleLowerCase('vi');
    const day = row.date.slice(6, 10) + '-' + row.date.slice(3, 5) + '-' + row.date.slice(0, 2);
    return (!search || `${row.item} ${row.sku}`.toLocaleLowerCase('vi').includes(search)) &&
      (!this.branch() || row.branchId === this.branchId(this.branch())) &&
      (!this.changeType() || row.action === this.changeType()) &&
      (!this.fromDate() || day >= this.fromDate());
  }));
  readonly currentRows = computed(() => this.stockFiltered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  readonly currentHistory = computed(() => this.historyFiltered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  readonly totalPages = computed(() => Math.max(1, Math.ceil((this.tab() === 'stock' ? this.stockFiltered().length : this.historyFiltered().length) / this.pageSize)));
  readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));
  readonly visibleCount = computed(() => this.tab() === 'stock' ? this.currentRows().length : this.currentHistory().length);
  readonly totalCount = computed(() => this.tab() === 'stock' ? this.stockFiltered().length : this.historyFiltered().length);
  readonly currentQuantity = computed(() => this.modal() === 'receipt' ? this.receiptStock()?.quantity ?? 0 : this.activeItem()?.quantity ?? 0);
  readonly preview = computed(() => {
    const amount = this.quantity() ?? 0;
    if (this.modal() === 'receipt') return this.currentQuantity() + amount;
    if (this.modal() === 'issue' || this.modal() === 'transfer') return this.currentQuantity() - amount;
    if (this.modal() === 'adjustment') return amount;
    return this.currentQuantity();
  });
  readonly destinationStock = computed(() => this.destinationItem()?.quantity ?? 0);
  readonly dialogTitle = computed(() => ({
    receipt: 'Nhập kho',
    issue: 'Xuất kho',
    adjustment: 'Điều chỉnh tồn kho',
    transfer: 'Chuyển kho',
    threshold: 'Cài ngưỡng',
  }[this.modal() ?? 'receipt']));

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      branches: this.inventoryApi.listBranches(),
      items: this.inventoryApi.listItems(),
      stocks: this.inventoryApi.listStocks(),
      products: this.inventoryApi.listCatalogProducts(),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ branches, items, stocks, products }) => {
        this.branchesData.set(branches);
        this.inventoryItems.set(items);
        this.catalogProducts.set(products);
        this.scopedBranchIds.set([...new Set(stocks.map(stock => stock.branchId))]);
        this.stock.set(this.makeStockRows(stocks, items, branches));
        this.page.set(1);
        this.loadHistory();
      },
      error: (error: unknown) => {
        this.stock.set([]);
        this.inventoryItems.set([]);
        this.catalogProducts.set([]);
        this.scopedBranchIds.set([]);
        this.branchesData.set([]);
        this.loadError.set(adminErrorMessage(error, 'Không tải được dữ liệu kho. Vui lòng thử lại.'));
      },
    });
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    this.historyError.set('');
    this.inventoryApi.listTransactions().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.historyLoading.set(false)),
    ).subscribe({
      next: transactions => this.history.set(this.makeHistoryRows(transactions)),
      error: (error: unknown) => {
        this.history.set([]);
        this.historyError.set(adminErrorMessage(error, 'Không tải được lịch sử kho. Vui lòng thử lại.'));
      },
    });
  }

  private makeStockRows(stocks: InventoryStockDto[], items: InventoryItemDto[], branches: InventoryBranchDto[]): StockItem[] {
    const itemById = new Map(items.map(item => [item.id, item]));
    const branchById = new Map(branches.map(b => [b.id, b.name]));
    const catalogBySku = this.catalogBySku();
    return stocks.flatMap(row => {
      const item = itemById.get(row.inventoryItemId);
      if (!item) return [];
      const product = catalogBySku.get(item.sku.trim().toLowerCase());
      // Product rows must belong to the active Product Master. Retired/orphan
      // InventoryItem records remain in BE for audit but are not saleable goods.
      // MATERIAL is a separate inventory type and remains visible.
      if (item.kind === 'PRODUCT' && !product) return [];
      return [{
        id: `${row.branchId}:${row.inventoryItemId}`,
        itemId: item.id,
        branchId: row.branchId,
        version: row.version,
        name: product?.name ?? item.name,
        variant: product?.hasVariant ? this.normalizedVariant(product.label) : '—',
        sku: item.sku,
        kind: product?.usage ?? (item.kind === 'PRODUCT' ? 'Hàng bán' as const : 'Vật tư dịch vụ' as const),
        branch: branchById.get(row.branchId) ?? row.branchId,
        quantity: row.quantity,
        threshold: row.thresholdConfigured === false || row.version === 0 ? null : row.lowStockThreshold,
      }];
    });
  }

  private makeHistoryRows(transactions: InventoryTransactionDto[]): StockHistory[] {
    const items = new Map(this.inventoryItems().map(item => [item.id, item]));
    const catalog = this.catalogBySku();
    const actions: Record<string, string> = { RECEIPT: 'Nhập kho', ISSUE: 'Xuất kho', ADJUSTMENT: 'Điều chỉnh', TRANSFER: 'Chuyển kho' };
    const transferGroups = new Map<string, InventoryTransactionDto[]>();
    for (const tx of transactions) {
      if (tx.transactionType !== 'TRANSFER' || tx.sourceType !== 'TRANSFER' || !tx.sourceId) continue;
      const group = transferGroups.get(tx.sourceId) ?? [];
      group.push(tx);
      transferGroups.set(tx.sourceId, group);
    }
    const branchLabel = (id: string): string => {
      const branch = this.branchesData().find(value => value.id.toLowerCase() === id.toLowerCase());
      if (!branch) return 'Chi nhánh chưa xác định';
      return branch.code && /^Q\\d+$/i.test(branch.code) ? branch.code.toUpperCase() : this.shortBranch(branch.name);
    };
    return transactions.map(tx => {
      const transfer = tx.sourceId && tx.sourceType === 'TRANSFER' ? transferGroups.get(tx.sourceId) ?? [] : [];
      const origin = transfer.find(value => value.changeQty < 0);
      const destination = transfer.find(value => value.changeQty > 0);
      const route = tx.transactionType === 'TRANSFER' && origin && destination
        ? `${branchLabel(origin.branchId)} → ${branchLabel(destination.branchId)}`
        : branchLabel(tx.branchId);
      const date = new Date(tx.createdAt);
      const two = (n: number) => String(n).padStart(2, '0');
      const formatted = `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
      return {
      id: tx.id,
      date: formatted,
      item: catalog.get((items.get(tx.inventoryItemId)?.sku || '').trim().toLowerCase())?.name
        || items.get(tx.inventoryItemId)?.name || tx.inventoryItemId,
      sku: items.get(tx.inventoryItemId)?.sku || '—',
      variant: (() => {
        const sku = items.get(tx.inventoryItemId)?.sku || '';
        const product = catalog.get(sku.trim().toLowerCase());
        return product?.hasVariant ? this.normalizedVariant(product.label) : '—';
      })(),
      branch: route,
      branchId: tx.branchId,
      action: actions[tx.transactionType] || tx.transactionType,
      reason: tx.reason,
      delta: tx.changeQty > 0 ? `+${tx.changeQty}` : String(tx.changeQty),
      after: String(tx.afterQty),
      reference: tx.id.slice(-8).toUpperCase(),
      actor: tx.actorName || (tx.isSystemActor ? 'Hệ thống' : 'Không rõ người thao tác'),
    };
    });
  }

  shortBranch(value: string): string { return value.replace('Chi nhánh Quận ', 'Q'); }
  branchId(name: string): string { return this.branchesData().find(b => b.name === name)?.id || ''; }
  private normalizedVariant(label: string | null | undefined): string {
    const value = label?.trim() || '';
    return !value || ['mặc định', 'default', '-', '—'].includes(value.toLowerCase())
      ? '—' : value;
  }
  formatVariantSku(variant: string | null | undefined, sku: string | null | undefined): string {
    const normalized = this.normalizedVariant(variant);
    return `${normalized === '—' ? '-' : normalized} | ${sku?.trim() || '-'}`;
  }
  productLabel(item: StockItem): string {
    return item.variant === '—' ? item.name : `${item.name} · ${item.variant}`;
  }
  inventoryItemLabel(item: InventoryItemDto): string {
    const product = this.catalogBySku().get(item.sku.trim().toLowerCase());
    if (!product) return item.name;
    const variant = product.hasVariant ? this.normalizedVariant(product.label) : '—';
    return variant === '—' ? product.name : `${product.name} · ${variant}`;
  }
  stockStatus(item: StockItem): string {
    if (item.quantity === 0) return 'Hết hàng';
    if (item.threshold === null) return 'Chưa cài ngưỡng';
    return item.quantity <= item.threshold ? 'Sắp hết hàng' : 'Đủ hàng';
  }

  switchTab(tab: 'stock' | 'history'): void {
    this.tab.set(tab);
    this.page.set(1);
    this.search.set('');
    this.branch.set('');
    this.status.set('');
    this.type.set('');
    this.changeType.set('');
    this.menuId.set(null);
  }
  onFilter(): void { this.page.set(1); }
  openDialog(kind: DialogKind, item?: StockItem): void {
    this.menuId.set(null);
    this.activeItem.set(kind === 'receipt' ? null : item ?? null);
    this.modal.set(kind);
    this.quantity.set(null);
    this.receiptBranch.set(this.branch() || item?.branch || this.branches()[0] || '');
    this.receiptSku.set('');
    this.threshold.set(kind === 'receipt' ? null : item?.threshold ?? null);
    this.destination.set('');
    this.note.set('');
    this.writeKey = crypto.randomUUID();
  }
  closeDialog(): void { if (!this.sending()) this.modal.set(null); }
  selectProduct(sku: string): void {
    this.receiptSku.set(sku);
    const product = this.productOptions().find(item => item.sku === sku);
    const selected = product
      ? this.stock().find(row => row.itemId === product.id && row.branch === this.receiptBranch())
        ?? {
          id: `${this.branchId(this.receiptBranch())}:${product.id}`,
          itemId: product.id,
          branchId: this.branchId(this.receiptBranch()),
          version: 0,
          name: this.catalogBySku().get(product.sku.toLowerCase())?.name ?? product.name,
          sku: product.sku,
          variant: (() => {
            const match = this.catalogBySku().get(product.sku.trim().toLowerCase());
            return match?.hasVariant ? this.normalizedVariant(match.label) : '—';
          })(),
          kind: this.catalogBySku().get(product.sku.toLowerCase())?.usage ??
            (product.kind === 'PRODUCT' ? 'Hàng bán' as const : 'Vật tư dịch vụ' as const),
          branch: this.receiptBranch(),
          quantity: 0,
          threshold: null,
        }
      : null;
    this.activeItem.set(selected);
    this.threshold.set(selected?.threshold ?? null);
    this.writeKey = crypto.randomUUID();
  }
  changeReceiptBranch(value: string): void {
    this.receiptBranch.set(value);
    if (this.receiptSku()) this.selectProduct(this.receiptSku());
  }
  changeDestination(value: string): void {
    this.destination.set(value);
    this.threshold.set(this.destinationItem()?.threshold ?? null);
    this.writeKey = crypto.randomUUID();
  }
  setQuantity(value: string): void {
    this.quantity.set(value === '' ? null : Number(value));
    this.writeKey = crypto.randomUUID();
  }
  setThreshold(value: string): void {
    this.threshold.set(value === '' ? null : Number(value));
    this.writeKey = crypto.randomUUID();
  }
  updateNote(value: string): void {
    this.note.set(value);
    this.writeKey = crypto.randomUUID();
  }
  valid(): string | null {
    const item = this.activeItem();
    if (!item) return 'Vui lòng chọn sản phẩm.';
    if (this.modal() === 'receipt' && this.receiptSku() !== item.sku) return 'Vui lòng chọn mã sản phẩm hợp lệ.';
    if (!item.itemId) return 'Không tìm thấy sản phẩm trong kho.';
    const validThreshold = Number.isInteger(this.threshold() ?? NaN) && (this.threshold() ?? -1) >= 0;
    if (this.modal() === 'threshold') {
      if (!validThreshold) return 'Vui lòng nhập ngưỡng cảnh báo hợp lệ.';
      if (this.threshold() === item.threshold) return 'Ngưỡng mới phải khác ngưỡng hiện tại.';
    } else {
      if (!Number.isInteger(this.quantity() ?? NaN) || (this.quantity() ?? -1) < (this.modal() === 'adjustment' ? 0 : 1))
        return 'Vui lòng nhập số lượng hợp lệ.';
      if (['issue', 'transfer'].includes(this.modal() ?? '') && (this.quantity() ?? 0) > this.currentQuantity())
        return 'Số lượng vượt quá tồn kho hiện tại.';
      if (this.modal() === 'receipt' && !this.branchId(this.receiptBranch()))
        return 'Vui lòng chọn chi nhánh nhập kho.';
      if (this.modal() === 'transfer' && (!this.destination() || this.destination() === item.branch))
        return 'Vui lòng chọn chi nhánh nhận khác chi nhánh xuất.';
      if (this.modal() === 'receipt' && !validThreshold)
        return 'Vui lòng cài ngưỡng cảnh báo tại chi nhánh nhập.';
      if (this.modal() === 'transfer' && this.destinationNeedsThreshold() && !validThreshold)
        return 'Vui lòng cài ngưỡng cảnh báo tại chi nhánh nhận.';
    }
    if (!this.note().trim() && this.modal() === 'receipt') return 'Vui lòng nhập lý do nhập kho.';
    if (this.modal() !== 'threshold' && this.note().trim().length < 3)
      return 'Vui lòng nhập lý do có ít nhất 3 ký tự.';
    return null;
  }

  notify(message: string, kind: 'success' | 'error' | 'info' = 'info'): void {
    this.adminToast.show(message, kind);
  }

  submit(): void {
    const errorMessage = this.valid();
    if (errorMessage) { this.notify(errorMessage, 'error'); return; }
    const item = this.activeItem();
    const kind = this.modal();
    if (!item || !kind || this.sending()) return;

    const branchId = kind === 'receipt' ? this.branchId(this.receiptBranch()) : item.branchId;
    const key = this.writeKey || crypto.randomUUID();
    const amount = this.quantity() ?? 0;
    const reason = this.note().trim();
    const movement: InventoryMovementWrite = { branchId, inventoryItemId: item.itemId, quantity: amount, reason };
    const threshold = this.threshold() ?? 0;

    let request: Observable<unknown>;
    let preliminaryThresholdSaved = false;
    if (kind === 'threshold') {
      request = this.inventoryApi.setThreshold(branchId, item.itemId, threshold, item.version, key);
    } else if (kind === 'receipt') {
      const existing = this.receiptStock();
      request = this.inventoryApi.receive(movement, key + '-movement');
      if (!existing || existing.threshold !== threshold) {
        request = this.inventoryApi.setThreshold(branchId, item.itemId, threshold, existing?.version ?? 0, key + '-threshold')
          .pipe(
            tap(() => { preliminaryThresholdSaved = true; }),
            switchMap(() => this.inventoryApi.receive(movement, key + '-movement')),
          );
      }
    } else if (kind === 'issue') {
      request = this.inventoryApi.issue(movement, key);
    } else if (kind === 'adjustment') {
      request = this.inventoryApi.adjust(movement, key);
    } else {
      const destinationId = this.branchId(this.destination());
      const transferBody = {
        fromBranchId: item.branchId,
        toBranchId: destinationId,
        inventoryItemId: item.itemId,
        quantity: amount,
        reason,
      };
      request = this.inventoryApi.transfer(transferBody, key + '-transfer');
      if (this.destinationNeedsThreshold()) {
        request = this.inventoryApi.setThreshold(
          destinationId, item.itemId, threshold, this.destinationItem()?.version ?? 0, key + '-threshold',
        ).pipe(
          tap(() => { preliminaryThresholdSaved = true; }),
          switchMap(() => this.inventoryApi.transfer(transferBody, key + '-transfer')),
        );
      }
    }

    this.sending.set(true);
    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sending.set(false)),
    ).subscribe({
      next: () => {
        this.modal.set(null);
        this.notify({
          receipt: 'Nhập kho thành công.',
          issue: 'Xuất kho thành công.',
          adjustment: 'Đã cập nhật tồn kho.',
          transfer: 'Chuyển kho thành công.',
          threshold: 'Đã lưu ngưỡng cảnh báo.',
        }[kind], 'success');
        this.loadAll();
      },
      error: (error: unknown) => {
        this.notify(
          preliminaryThresholdSaved
            ? 'Ngưỡng cảnh báo đã được lưu, nhưng giao dịch chưa hoàn tất. Vui lòng kiểm tra tồn kho trước khi thử lại.'
            : adminErrorMessage(error, 'Thao tác chưa thành công. Vui lòng kiểm tra tồn kho rồi thử lại.'),
          'error',
        );
        this.loadAll();
      },
    });
  }

  setPage(n: number): void {
    this.page.set(Math.max(1, Math.min(this.totalPages(), n)));
  }
}
