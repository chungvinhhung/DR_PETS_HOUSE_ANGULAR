import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { finalize, firstValueFrom, TimeoutError, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppHttpError } from '../../../../../core/models/app-http-error.model';
import { AdminCategory, CategoryPageResponse } from '../../../categories/models/admin-category.model';
import { AdminCategoryService } from '../../../categories/services/admin-category.service';
import { AdminProductService } from '../../services/admin-product.service';
import { ProductWrite } from '../../models/admin-product.model';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../../shared/admin-catalog-shell/admin-catalog-shell.component';

interface ProductImageDraft {
  id: number;
  file: File;
  previewUrl: string;
}

interface VariantDraft {
  label: string;
  sku: string;
  price: number;
  discount: number;
  active: boolean;
  imageFile: File | null;
  imageUrl: string | null;
}

@Component({
  selector: 'app-admin-product-create-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-product-create-page.component.html',
  styleUrl: './admin-product-create-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AdminProductCreatePageComponent implements OnInit, OnDestroy {
  private readonly categoryService = inject(AdminCategoryService);
  private readonly productService = inject(AdminProductService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private createAttemptFingerprint: string | null = null;
  private createAttemptKey: string | null = null;

  categories: AdminCategory[] = [];
  loadingCategories = false;
  categoryError = '';
  saving = false;
  createdProductId: string | null = null;
  private destroyed = false;
  productName = '';
  categoryId = '';
  usageType = '';
  description = '';
  hasVariants = true;
  active = false;
  // Only show previews for photos that the user has actually uploaded.
  images: ProductImageDraft[] = [];
  primaryImageId: number | null = null;
  feedback = '';
  leaveDialogOpen = false;
  private leaveResolver: ((confirmed: boolean) => void) | null = null;

  // No demonstration SKU/price data should be accidentally saved.
  variants: VariantDraft[] = [this.newVariant()];

  private nextImageId = 1;
  private readonly maxImageCount = 10;
  private readonly maxImageSize = 5 * 1024 * 1024;

  get priceRange(): string {
    const prices = this.variants.map(v => Number(v.price) || 0);
    if (!prices.length) return '0đ';
    return `${Math.min(...prices).toLocaleString('vi-VN')}đ – ${Math.max(...prices).toLocaleString('vi-VN')}đ`;
  }

  finalPrice(v: VariantDraft): number {
    return Math.round(
      Math.max(0, Number(v.price) || 0) *
      (1 - Math.min(100, Math.max(0, Number(v.discount) || 0)) / 100),
    );
  }

  private newVariant(label = '', price = 0): VariantDraft {
    return {
      label,
      sku: '',
      price,
      discount: 0,
      active: false,
      imageFile: null,
      imageUrl: null,
    };
  }

  private releaseVariantImage(variant: VariantDraft): void {
    if (variant.imageUrl) URL.revokeObjectURL(variant.imageUrl);
    variant.imageFile = null;
    variant.imageUrl = null;
  }

  selectVariantMode(value: boolean): void {
    if (value === this.hasVariants) return;
    this.variants.forEach(v => this.releaseVariantImage(v));
    this.hasVariants = value;
    this.variants = value
      ? [this.newVariant()]
      : [this.newVariant('Mặc định')];
  }

  addVariant(): void {
    this.variants.push(this.newVariant());
  }

  removeVariant(index: number): void {
    if (this.variants.length <= 1) return;
    const removed = this.variants.splice(index, 1)[0];
    if (removed) this.releaseVariantImage(removed);
  }

  private isValidImage(file: File): boolean {
    return ['image/jpeg', 'image/png'].includes(file.type) &&
      file.size <= this.maxImageSize;
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    const validFiles = files.filter(file => this.isValidImage(file));
    const allowed = validFiles.slice(
      0,
      Math.max(0, this.maxImageCount - this.images.length),
    );

    for (const file of allowed) {
      this.images.push({
        id: this.nextImageId++,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    // Exactly one main image: pick the first uploaded image, unless the
    // user has explicitly chosen a different existing one.
    if (this.primaryImageId === null && this.images.length > 0) {
      this.primaryImageId = this.images[0].id;
    }

    if (validFiles.length !== files.length) {
      this.feedback = 'Chỉ hỗ trợ ảnh JPG/PNG, tối đa 5MB mỗi ảnh.';
    } else if (allowed.length !== validFiles.length) {
      this.feedback = 'Chỉ được tải tối đa 10 ảnh sản phẩm.';
    } else {
      this.feedback = '';
    }
  }

  setPrimaryImage(id: number): void {
    if (this.images.some(image => image.id === id)) {
      this.primaryImageId = id;
    }
  }

  replaceProductImage(event: Event, id: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const image = this.images.find(item => item.id === id);
    if (!image) return;
    if (!this.isValidImage(file)) {
      this.feedback = 'Ảnh thay thế phải là JPG/PNG và không quá 5MB.';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    URL.revokeObjectURL(image.previewUrl);
    image.file = file;
    image.previewUrl = previewUrl;
    // Keep this image's ID and main-image selection unchanged.
    this.feedback = '';
  }

  removeProductImage(id: number): void {
    const index = this.images.findIndex(image => image.id === id);
    if (index === -1) return;
    const [removed] = this.images.splice(index, 1);
    URL.revokeObjectURL(removed.previewUrl);
    if (this.primaryImageId === id) {
      this.primaryImageId = this.images[0]?.id ?? null;
    }
  }

  onVariantImageSelected(event: Event, variant: VariantDraft): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!this.isValidImage(file)) {
      this.feedback = 'Ảnh biến thể phải là JPG/PNG và không quá 5MB.';
      return;
    }

    this.releaseVariantImage(variant);
    variant.imageFile = file;
    variant.imageUrl = URL.createObjectURL(file);
    this.feedback = '';
  }

  ngOnInit(): void {
    void this.loadCategories();
  }

  async loadCategories(): Promise<void> {
    if (this.loadingCategories) return;
    this.loadingCategories = true;
    this.categoryError = '';
    try {
      const results = new Map<string, AdminCategory>();
      let cursor: string | null = null;
      // OpenAPI page limit is 100. Read subsequent pages for large catalogs.
      for (let page = 0; page < 30; page++) {
        const response: CategoryPageResponse = await firstValueFrom(this.categoryService.listCategories({
          limit: 100,
          status: 'ACTIVE',
          cursor,
        }));
        if (this.destroyed) return;
        for (const item of response.items) {
          if (item.status === 'ACTIVE') results.set(item.id, item);
        }
        cursor = response.nextCursor;
        if (!cursor) break;
        if (page === 29) {
          throw new Error('Danh mục quá nhiều, chưa thể tải hết. Vui lòng thử lại.');
        }
      }
      this.categories = [...results.values()].sort(
        (a, b) => a.name.localeCompare(b.name, 'vi'),
      );
      if (this.categoryId && !results.has(this.categoryId)) this.categoryId = '';
    } catch (error: unknown) {
      if (!this.destroyed) {
        this.categoryError = error instanceof Error ? error.message : 'Không thể tải danh mục.';
      }
    } finally {
      if (!this.destroyed) {
        this.loadingCategories = false;
        this.cdr.markForCheck();
      }
    }
  }

  /** Do not treat an untouched form as dirty, including its default empty variant row. */
  hasUnsavedChanges(): boolean {
    if (this.createdProductId) return false;
    if (this.productName.trim() || this.categoryId || this.usageType || this.description.trim()) return true;
    if (this.images.length || this.active || !this.hasVariants || this.variants.length !== 1) return true;
    return this.variants.some(v =>
      !!v.label.trim() || !!v.sku.trim() || Number(v.price) !== 0 ||
      Number(v.discount) !== 0 || v.active || !!v.imageFile,
    );
  }

  /** Angular CanDeactivate: covers breadcrumb, Cancel, sidebar and browser Back. */
  canLeavePage(): boolean | Promise<boolean> {
    if (this.saving) return false;
    if (!this.hasUnsavedChanges()) return true;
    if (this.leaveResolver) return false;
    this.leaveDialogOpen = true;
    this.cdr.markForCheck();
    return new Promise<boolean>(resolve => { this.leaveResolver = resolve; });
  }

  resolveLeave(confirmed: boolean): void {
    const resolver = this.leaveResolver;
    this.leaveResolver = null;
    this.leaveDialogOpen = false;
    this.cdr.markForCheck();
    resolver?.(confirmed);
  }

  @HostListener('window:beforeunload', ['$event'])
  confirmBrowserUnload(event: BeforeUnloadEvent): void {
    if (!this.saving && !this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.images.forEach(image => URL.revokeObjectURL(image.previewUrl));
    this.variants.forEach(variant => this.releaseVariantImage(variant));
  }

  saveDraft(): void {
    if (this.saving || this.createdProductId) return;
    const name = this.productName.trim();
    const selectedCategory = this.categories.find(item => item.id === this.categoryId);
    if (!name || !selectedCategory || !this.usageType) {
      this.feedback = 'Vui lòng nhập tên sản phẩm, chọn loại sử dụng và danh mục đang hoạt động.';
      return;
    }

    // Contract v7 treats Product as a purchasable master item. These two
    // usage modes require BE business handling before data can be persisted.
    if (this.usageType !== 'SALE') {
      this.feedback = 'BE hiện chỉ hỗ trợ tạo Hàng bán. Dùng chung và Vật tư dịch vụ đang chờ bổ sung API.';
      return;
    }
    if (this.images.length || this.variants.some(v => v.imageFile)) {
      this.feedback = 'Ảnh đang được xem trước trên máy. BE chưa có API upload ảnh nên chưa thể lưu sản phẩm có ảnh.';
      return;
    }
    if (this.variants.some(v => Number(v.discount) !== 0)) {
      this.feedback = 'BE chưa hỗ trợ lưu khuyến mại (%). Vui lòng đặt 0% để tạo sản phẩm mà không mất thông tin.';
      return;
    }
    if (!this.variants.length || this.variants.some(v =>
      !v.label.trim() ||
      !v.sku.trim() ||
      !Number.isSafeInteger(Number(v.price)) ||
      Number(v.price) < 0
    )) {
      this.feedback = 'Mỗi biến thể phải có tên, SKU và giá bán hợp lệ (số nguyên không âm).';
      return;
    }

    const skus = this.variants.map(v => v.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length) {
      this.feedback = 'SKU giữa các biến thể không được trùng nhau.';
      return;
    }

    const payload: ProductWrite = {
      name,
      description: this.description.trim(),
      categoryId: selectedCategory.id,
      status: this.active ? 'ACTIVE' : 'INACTIVE',
      variants: this.variants.map(v => ({
        label: v.label.trim(),
        sku: v.sku.trim(),
        price: Number(v.price),
        status: v.active ? 'ACTIVE' : 'INACTIVE',
      })),
    };

    // Keep the same idempotency key if the same payload needs to be retried
    // after a lost response. A changed form gets a fresh key.
    const fingerprint = JSON.stringify(payload);
    if (this.createAttemptFingerprint !== fingerprint || !this.createAttemptKey) {
      this.createAttemptFingerprint = fingerprint;
      this.createAttemptKey = crypto.randomUUID();
    }

    this.saving = true;
    this.feedback = '';
    this.cdr.markForCheck();

    try {
      this.productService.createProduct(payload, this.createAttemptKey).pipe(
        // Angular 22 is zoneless by default. Explicitly schedule view refresh
        // after async RxJS callbacks; otherwise "Đang lưu..." stays visible.
        timeout({ first: 30000 }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving = false;
          if (!this.destroyed) this.cdr.markForCheck();
        }),
      ).subscribe({
        next: product => {
          this.createdProductId = product.id;
          this.feedback = 'Đã tạo sản phẩm thành công (mã: ' + product.id + '). Tồn kho ban đầu bằng 0 và phải nhập qua module Kho.';
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          if (error instanceof TimeoutError) {
            this.feedback = 'Chưa nhận được phản hồi từ Backend sau 30 giây. Sản phẩm CÓ THỂ đã được tạo. Hãy kiểm tra log BE và danh sách sản phẩm trước khi thử lưu lại để tránh trùng.';
          } else {
            const message = error instanceof AppHttpError
              ? error.message
              : error instanceof Error ? error.message : 'Không thể lưu sản phẩm.';
            this.feedback = 'Không lưu được sản phẩm: ' + message;
          }
          this.cdr.markForCheck();
        },
      });
    } catch (error: unknown) {
      // Guard against a synchronous API setup failure leaving saving=true.
      this.saving = false;
      this.feedback = 'Không khởi tạo được request lưu sản phẩm: ' +
        (error instanceof Error ? error.message : 'Lỗi không xác định.');
      this.cdr.markForCheck();
    }
  }
}
