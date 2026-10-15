import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom, timeout } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminCategoryService } from '../../../categories/services/admin-category.service';
import { AdminCategory } from '../../../categories/models/admin-category.model';
import { AdminProductService } from '../../services/admin-product.service';
import { AdminProduct, ProductQuery, ProductSort, ProductStatus, ProductUsageType } from '../../models/admin-product.model';
import { ADMIN_TABLE_PAGE_SIZE, countCursorItems } from '../../../../../shared/utils/admin-table-pagination';

@Component({
  selector: 'app-admin-product-list-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-product-list-page.component.html',
  styleUrl: './admin-product-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductListPageComponent implements OnInit {
  private readonly productsApi = inject(AdminProductService);
  private readonly router = inject(Router);
  private readonly categoriesApi = inject(AdminCategoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = ADMIN_TABLE_PAGE_SIZE;
  readonly products = signal<AdminProduct[]>([]);
  readonly categories = signal<AdminCategory[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly updatingId = signal<string | null>(null);
  readonly archiveTarget = signal<AdminProduct | null>(null);
  readonly archiveError = signal('');
  readonly restoreTarget = signal<AdminProduct | null>(null);
  readonly restoreError = signal('');
  private readonly archiveKeys = new Map<string, string>();
  readonly pageNumber = signal(1);
  readonly nextCursor = signal<string | null>(null);
  readonly totalProducts = signal<number | null>(null);

  searchTerm = '';
  categoryFilter = '';
  usageFilter: ProductUsageType | '' = '';
  priceFilter = '';
  daysFilter = 0;
  statusFilter: ProductStatus | '' = '';
  sort: ProductSort = 'NEWEST';
  archiveView = false;
  filterOpen = false;
  private cursors: (string | null)[] = [null];
  private requestNumber = 0;
  private countGeneration = 0;
  private countRequested = false;

  ngOnInit(): void {
    const navState = window.history.state as { productNotice?: unknown } | null;
    if (typeof navState?.productNotice === 'string') {
      this.notice.set(navState.productNotice);
      // Do not re-show the same success notice after a reload.
      const { productNotice: ignored, ...rest } = navState;
      window.history.replaceState(rest, '', window.location.href);
    }
    void this.loadCategories();
    this.loadPage(1);
  }

  private async loadCategories(): Promise<void> {
    try {
      const result = await firstValueFrom(this.categoriesApi.listCategories({ limit: 100 }));
      this.categories.set(result.items);
    } catch {
      // List remains usable with category IDs if metadata is temporarily unavailable.
    }
  }

  onSearchInput(): void {
    // Search is applied on Enter; keep the entered value editable until then.
  }

  toggleCategory(id: string): void {
    this.categoryFilter = this.categoryFilter === id ? '' : id;
  }

  toggleUsage(value: ProductUsageType): void {
    this.usageFilter = this.usageFilter === value ? '' : value;
  }

  togglePrice(value: string): void {
    this.priceFilter = this.priceFilter === value ? '' : value;
  }

  toggleDays(value: number): void {
    this.daysFilter = this.daysFilter === value ? 0 : value;
  }

  toggleStatus(status: 'ACTIVE' | 'INACTIVE'): void {
    this.statusFilter = this.statusFilter === status ? '' : status;
  }

  clearFilters(): void {
    this.categoryFilter = '';
    this.usageFilter = '';
    this.priceFilter = '';
    this.daysFilter = 0;
    this.statusFilter = this.archiveView ? 'ARCHIVED' : '';
    this.searchTerm = '';
    this.sort = 'NEWEST';
    this.applyFilters();
    this.filterOpen = false;
  }

  applyFilters(): void {
    ++this.countGeneration;
    this.countRequested = false;
    this.totalProducts.set(null);
    this.cursors = [null];
    this.pageNumber.set(1);
    this.loadPage(1);
  }

  selectArchiveView(archived: boolean): void {
    if (this.archiveView === archived) return;
    this.archiveView = archived;
    this.statusFilter = archived ? 'ARCHIVED' : '';
    this.filterOpen = false;
    this.applyFilters();
  }

  loadPage(page: number): void {
    const cursor = this.cursors[page - 1];
    if (page < 1 || cursor === undefined || this.loading()) return;
    const serial = ++this.requestNumber;
    this.loading.set(true);
    this.error.set('');
    const query: ProductQuery = {
      limit: this.pageSize,
      cursor,
      q: this.searchTerm.trim() || undefined,
      categoryId: this.categoryFilter || undefined,
      usageType: this.usageFilter || undefined,
      createdWithinDays: this.daysFilter || undefined,
      minPrice: this.priceFilter === 'MID' ? 100000 : this.priceFilter === 'HIGH' ? 500001 : undefined,
      maxPrice: this.priceFilter === 'LOW' ? 99999 : this.priceFilter === 'MID' ? 500000 : undefined,
      status: this.archiveView ? 'ARCHIVED' : this.statusFilter || undefined,
      sort: this.sort,
    };
    this.productsApi.listProducts(query).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: result => {
        if (serial !== this.requestNumber) return;
        // Current tab should never render archived rows; the BE currently
        // allows ADMIN to see every status without an explicit status filter.
        const items = this.archiveView
          ? result.items.filter(p => p.status === 'ARCHIVED')
          : result.items.filter(p => p.status !== 'ARCHIVED');
        this.products.set(items);
        // Prefer server metadata when its filter matches the displayed view.
        // In the unfiltered view BE may include archived products, which FE hides.
        const apiTotal = result.totalItems ?? result.totalCount ?? result.total;
        if (
          (this.archiveView || !!this.statusFilter) &&
          typeof apiTotal === 'number' && Number.isSafeInteger(apiTotal) && apiTotal >= 0
        ) {
          this.totalProducts.set(apiTotal);
        } else if (page === 1 && !result.nextCursor) {
          this.totalProducts.set(items.length);
        } else {
          this.countDisplayedProducts(query);
        }
        this.pageNumber.set(page);
        this.nextCursor.set(result.nextCursor ?? null);
        this.cursors = this.cursors.slice(0, page);
        if (result.nextCursor) this.cursors[page] = result.nextCursor;
      },
      error: error => {
        if (serial === this.requestNumber) {
          this.error.set(error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm.');
          this.products.set([]);
        }
      },
    });
  }

  private countDisplayedProducts(query: ProductQuery): void {
    if (this.countRequested || this.totalProducts() !== null) return;
    this.countRequested = true;
    const generation = this.countGeneration;
    const archiveView = this.archiveView;
    void countCursorItems(
      (cursor) => this.productsApi.listProducts({ ...query, cursor, limit: 100 }),
      (product: AdminProduct) => archiveView
        ? product.status === 'ARCHIVED'
        : product.status !== 'ARCHIVED',
    ).then((total) => {
      if (generation === this.countGeneration && total !== null) {
        this.totalProducts.set(total);
      }
    });
  }

  previous(): void {
    if (this.pageNumber() > 1) this.loadPage(this.pageNumber() - 1);
  }

  next(): void {
    if (this.nextCursor()) this.loadPage(this.pageNumber() + 1);
  }

  categoryName(id: string): string {
    return this.categories().find(item => item.id === id)?.name || '—';
  }

  productSku(product: AdminProduct): string {
    return product.variants.map(v => v.sku).join(', ') || '—';
  }

  priceRange(product: AdminProduct): string {
    // Keep Product List pricing consistent with Create/Edit and the payable price.
    const prices = product.variants
      .filter(v => Number.isFinite(Number(v.price)) && Number(v.price) >= 0)
      .map(v => {
        const discount = Math.min(100, Math.max(0, Number(v.discountPercent) || 0));
        return Math.round(Number(v.price) * (1 - discount / 100));
      });
    if (!prices.length) return '—';
    const min = Math.min(...prices), max = Math.max(...prices);
    const currency = (value: number) => value.toLocaleString('vi-VN') + 'đ';
    return min === max ? currency(min) : currency(min) + ' – ' + currency(max);
  }

  updateStatus(product: AdminProduct): void {
    if (product.status === 'ARCHIVED' || this.updatingId()) return;
    this.updatingId.set(product.id);
    this.error.set('');
    // OpenAPI v7 PATCH currently validates against ProductWrite, whose
    // required name/category/variants must be present even for status changes.
    this.productsApi.updateProduct(product.id, {
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId,
      variants: product.variants.map(v => ({
        id: v.id, label: v.label, sku: v.sku, price: v.price, status: v.status,
      })),
      status: product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
    }).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updatingId.set(null)),
    ).subscribe({
      next: updated => {
        this.products.update(rows => rows.map(row => row.id === product.id ? updated : row));
      },
      error: err => this.error.set(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.'),
    });
  }

  requestArchive(product: AdminProduct): void {
    if (product.status === 'ARCHIVED' || this.updatingId()) return;
    this.archiveError.set('');
    this.archiveTarget.set(product);
  }

  closeArchiveDialog(): void {
    if (!this.updatingId()) this.archiveTarget.set(null);
  }

  confirmArchive(): void {
    const product = this.archiveTarget();
    if (!product || this.updatingId()) return;
    const key = this.archiveKeys.get(product.id) ?? crypto.randomUUID();
    this.archiveKeys.set(product.id, key);
    this.updatingId.set(product.id);
    this.archiveError.set('');
    this.productsApi.archiveProduct(product.id, key).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updatingId.set(null)),
    ).subscribe({
      next: () => {
        this.archiveKeys.delete(product.id);
        this.archiveTarget.set(null);
        this.applyFilters();
      },
      error: error => {
        this.archiveError.set(
          (error instanceof Error ? error.message : 'Không thể lưu trữ sản phẩm.') +
          ' Nếu kết quả chưa rõ, hãy kiểm tra tab Đã lưu trữ trước khi thử lại.',
        );
      },
    });
  }

  requestRestore(product: AdminProduct): void {
    if (product.status !== 'ARCHIVED' || this.updatingId()) return;
    this.restoreError.set('');
    this.restoreTarget.set(product);
  }

  closeRestoreDialog(): void {
    if (!this.updatingId()) this.restoreTarget.set(null);
  }

  confirmRestore(): void {
    const product = this.restoreTarget();
    if (!product || product.status !== 'ARCHIVED' || this.updatingId()) return;
    this.restoreError.set('');
    this.updatingId.set(product.id);
    this.productsApi.restoreProduct(product.id, crypto.randomUUID()).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updatingId.set(null)),
    ).subscribe({
      next: () => {
        this.restoreTarget.set(null);
        this.applyFilters();
      },
      error: (error: unknown) => {
        this.restoreError.set(
          (error instanceof Error ? error.message : 'Không thể khôi phục sản phẩm.') +
          ' Nếu chưa rõ kết quả, hãy kiểm tra tab Sản phẩm hiện tại trước khi thử lại.',
        );
      },
    });
  }

  trackProduct(_index: number, item: AdminProduct): string { return item.id; }
}
