import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom, timeout } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminCategoryService } from '../../../categories/services/admin-category.service';
import { AdminCategory } from '../../../categories/models/admin-category.model';
import { AdminProductService } from '../../services/admin-product.service';
import { AdminProduct, ProductQuery, ProductSort, ProductStatus } from '../../models/admin-product.model';

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
  private readonly categoriesApi = inject(AdminCategoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly products = signal<AdminProduct[]>([]);
  readonly categories = signal<AdminCategory[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
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
  statusFilter: ProductStatus | '' = '';
  sort: ProductSort = 'NEWEST';
  archiveView = false;
  filterOpen = false;
  private cursors: (string | null)[] = [null];
  private requestNumber = 0;

  ngOnInit(): void {
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

  toggleStatus(status: 'ACTIVE' | 'INACTIVE'): void {
    this.statusFilter = this.statusFilter === status ? '' : status;
  }

  clearFilters(): void {
    this.categoryFilter = '';
    this.statusFilter = this.archiveView ? 'ARCHIVED' : '';
    this.searchTerm = '';
    this.sort = 'NEWEST';
    this.applyFilters();
    this.filterOpen = false;
  }

  applyFilters(): void {
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
      limit: 20,
      cursor,
      q: this.searchTerm.trim() || undefined,
      categoryId: this.categoryFilter || undefined,
      status: this.archiveView ? 'ARCHIVED' : this.statusFilter || undefined,
      sort: this.sort,
    };
    this.productsApi.listProducts(query).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: result => {
        const meta = result as typeof result & { total?: number; totalCount?: number };
        this.totalProducts.set(typeof meta.total === 'number' ? meta.total : typeof meta.totalCount === 'number' ? meta.totalCount : null);
        if (serial !== this.requestNumber) return;
        // Current tab should never render archived rows; the BE currently
        // allows ADMIN to see every status without an explicit status filter.
        const items = this.archiveView
          ? result.items.filter(p => p.status === 'ARCHIVED')
          : result.items.filter(p => p.status !== 'ARCHIVED');
        this.products.set(items);
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
    const prices = product.variants.map(v => v.price).filter(Number.isFinite);
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
    // BE does not expose a dedicated restore route. PATCH ProductWrite is
    // required by OpenAPI v7; retain all existing data and only change status.
    this.productsApi.updateProduct(product.id, {
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId,
      images: [...(product.images ?? [])],
      variants: product.variants.map(v => ({
        id: v.id, sku: v.sku, label: v.label, price: v.price, status: v.status,
      })),
      // Do not put the archived item back on sale without manual review.
      status: 'INACTIVE',
    }).pipe(
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
