import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom, timeout } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminCategoryService } from '../../../categories/services/admin-category.service';
import { AdminCategory } from '../../../categories/models/admin-category.model';
import { AdminProductService } from '../../services/admin-product.service';
import { AdminProduct, ProductVariantWrite, ProductWrite } from '../../models/admin-product.model';

@Component({
  selector: 'app-admin-product-edit-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-product-edit-page.component.html',
  styleUrl: './admin-product-edit-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductEditPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AdminProductService);
  private readonly categoriesApi = inject(AdminCategoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly categories = signal<AdminCategory[]>([]);
  readonly product = signal<AdminProduct | null>(null);

  name = '';
  description = '';
  categoryId = '';
  active = false;
  variants: ProductVariantWrite[] = [];

  get hasVariants(): boolean { return this.variants.length > 1; }
  get priceRange(): string {
    const prices = this.variants.map(v => Number(v.price)).filter(Number.isFinite);
    if (!prices.length) return '—';
    const minimum = Math.min(...prices), maximum = Math.max(...prices);
    return minimum === maximum ? this.formatPrice(minimum) : this.formatPrice(minimum) + ' – ' + this.formatPrice(maximum);
  }
  get singleFinalPrice(): string { return this.formatPrice(this.variants[0]?.price ?? 0); }
  formatPrice(price: number): string { return Number(price || 0).toLocaleString('vi-VN') + 'đ'; }
  onSingleSkuInput(event: Event): void {
    if (this.hasVariants || !this.variants.length) return;
    this.variants[0].sku = (event.target as HTMLInputElement).value;
  }

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Thiếu mã sản phẩm.');
      this.loading.set(false);
      return;
    }
    try {
      const [product, categories] = await Promise.all([
        firstValueFrom(this.api.getProduct(id).pipe(timeout({ first: 30000 }))),
        firstValueFrom(this.categoriesApi.listCategories({ limit: 100 }).pipe(timeout({ first: 30000 }))),
      ]);
      this.product.set(product);
      this.categories.set(categories.items);
      this.name = product.name;
      this.description = product.description ?? '';
      this.categoryId = product.categoryId;
      this.active = product.status === 'ACTIVE';
      this.variants = product.variants.map(v => ({
        id: v.id, sku: v.sku, label: v.label, price: v.price, status: v.status,
      }));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Không thể lấy chi tiết sản phẩm.');
    } finally {
      this.loading.set(false);
    }
  }

  save(): void {
    const item = this.product();
    if (!item || this.saving()) return;
    this.error.set('');
    this.success.set('');
    if (!this.name.trim() || !this.categoryId || !this.variants.length ||
        this.variants.some(v => !v.sku.trim() || !v.label.trim() || !Number.isSafeInteger(Number(v.price)) || Number(v.price) < 0)) {
      this.error.set('Vui lòng nhập tên, danh mục và thông tin SKU/giá hợp lệ.');
      return;
    }
    const normalized = this.variants.map(v => v.sku.trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      this.error.set('SKU của các biến thể không được trùng nhau.');
      return;
    }
    const body: ProductWrite = {
      name: this.name.trim(),
      description: this.description.trim(),
      categoryId: this.categoryId,
      status: this.active ? 'ACTIVE' : 'INACTIVE',
      variants: this.variants.map(v => ({
        id: v.id, label: v.label.trim(), sku: v.sku.trim(), price: Number(v.price), status: v.status,
      })),
    };
    this.saving.set(true);
    this.api.updateProduct(item.id, body).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: updated => {
        this.product.set(updated);
        this.success.set('Cập nhật sản phẩm thành công.');
      },
      error: error => this.error.set(error instanceof Error ? error.message : 'Không thể cập nhật sản phẩm.'),
    });
  }

  addVariant(): void {
    this.variants = [...this.variants, { label: '', sku: '', price: 0, status: 'INACTIVE' }];
  }

  removeVariant(index: number): void {
    if (this.variants.length > 1) this.variants = this.variants.filter((_, i) => i !== index);
  }
}
