import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom, timeout } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminCategoryService } from '../../../categories/services/admin-category.service';
import { AdminCategory } from '../../../categories/models/admin-category.model';
import { AdminProductService } from '../../services/admin-product.service';
import { AdminProduct, ProductImage, ProductUsageType, ProductVariantWrite, ProductWrite } from '../../models/admin-product.model';

interface EditableProductImage {
  id: number;
  savedImage: ProductImage | null;
  previewUrl: string;
  localFile: File | null;
}

@Component({
  selector: 'app-admin-product-edit-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-product-edit-page.component.html',
  styleUrl: './admin-product-edit-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductEditPageComponent implements OnInit, OnDestroy {
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
  usageType: ProductUsageType = 'SALE';
  active = false;
  variants: ProductVariantWrite[] = [];
  imageSlots: EditableProductImage[] = [];
  imageError = '';
  private nextImageId = 1;
  readonly leaveDialogOpen = signal(false);
  readonly addVariantOpen = signal(false);
  readonly variantActionTarget = signal<ProductVariantWrite | null>(null);
  readonly variantActionError = signal('');
  newVariantLabel = '';
  newVariantPrice = 0;
  newVariantDiscount = 0;
  newVariantActive = false;
  private addVariantFingerprint = '';
  private addVariantKey = '';
  private readonly deactivateKeys = new Map<string, string>();
  private readonly variantImageFiles = new Map<string, File>();
  private readonly variantImagePreviews = new Map<string, string>();
  private readonly variantUploadCache = new WeakMap<File, string>();
  private leaveResolver: ((confirmed: boolean) => void) | null = null;
  private lastSavedSnapshot = '';

  get hasVariants(): boolean { return this.product()?.productType === 'VARIANT'; }
  get priceRange(): string {
    const prices = this.variants.map(v => Number(v.price)).filter(Number.isFinite);
    if (!prices.length) return '—';
    const minimum = Math.min(...prices), maximum = Math.max(...prices);
    return minimum === maximum ? this.formatPrice(minimum) : this.formatPrice(minimum) + ' – ' + this.formatPrice(maximum);
  }
  get singleFinalPrice(): string {
    const v = this.variants[0];
    return this.formatPrice(Math.round(Number(v?.price ?? 0) * (1 - Number(v?.discountPercent ?? 0) / 100)));
  }
  formatPrice(price: number): string { return Number(price || 0).toLocaleString('vi-VN') + 'đ'; }
  formatVariantFinalPrice(variant: ProductVariantWrite): string {
    const discount = Math.min(100, Math.max(0, Number(variant.discountPercent ?? 0)));
    return this.formatPrice(Math.round(Number(variant.price || 0) * (1 - discount / 100)));
  }
  private draftSnapshot(): string {
    return JSON.stringify({
      name: this.name, description: this.description, categoryId: this.categoryId, usageType: this.usageType,
      active: this.active,
      variants: this.variants.map(v => ({ id: v.id, sku: v.sku, label: v.label, price: v.price, discountPercent: v.discountPercent, image: v.image, status: v.status })),
      images: this.imageSlots.map(image => ({
        id: image.id,
        savedUrl: image.savedImage?.url,
        fileName: image.localFile?.name,
        fileSize: image.localFile?.size,
        fileModified: image.localFile?.lastModified,
      })),
    });
  }

  hasUnsavedChanges(): boolean {
    return !!this.product() && this.draftSnapshot() !== this.lastSavedSnapshot;
  }

  canLeavePage(): boolean | Promise<boolean> {
    if (this.saving()) return false;
    if (!this.hasUnsavedChanges()) return true;
    if (this.leaveResolver) return false;
    this.leaveDialogOpen.set(true);
    return new Promise<boolean>(resolve => { this.leaveResolver = resolve; });
  }

  resolveLeave(confirmed: boolean): void {
    const resolver = this.leaveResolver;
    this.leaveResolver = null;
    this.leaveDialogOpen.set(false);
    resolver?.(confirmed);
  }

  @HostListener('window:beforeunload', ['$event'])
  confirmBrowserUnload(event: BeforeUnloadEvent): void {
    if (!this.saving() && !this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    this.imageSlots.forEach(image => this.releaseImagePreview(image));
    this.variantImagePreviews.forEach(url => URL.revokeObjectURL(url));
    this.variantImagePreviews.clear();
  }

  private releaseImagePreview(image: EditableProductImage): void {
    if (image.localFile) URL.revokeObjectURL(image.previewUrl);
  }

  private fromSavedImages(images: ProductImage[]): EditableProductImage[] {
    return images.map(image => ({
      id: this.nextImageId++,
      savedImage: image,
      previewUrl: image.url,
      localFile: null,
    }));
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
      this.usageType = product.usageType ?? 'SALE';
      this.active = product.status === 'ACTIVE';
      this.imageSlots = this.fromSavedImages(product.images ?? []);
      this.variants = product.variants.map(v => ({
        id: v.id, sku: v.sku, label: v.label, price: v.price, status: v.status, discountPercent: v.discountPercent, image: v.image,
      }));
      this.lastSavedSnapshot = this.draftSnapshot();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Không thể lấy chi tiết sản phẩm.');
    } finally {
      this.loading.set(false);
    }
  }

  save(): void {
    const item = this.product();
    if (!item || this.saving()) return;
    if (item.status === 'ARCHIVED') {
      this.error.set('Vui lòng khôi phục sản phẩm từ tab Đã lưu trữ trước khi chỉnh sửa.');
      return;
    }
    this.error.set('');
    this.success.set('');
    if (!this.name.trim() || !this.categoryId || !this.variants.length ||
        this.variants.some(v => !v.sku?.trim() || !v.label.trim() || !Number.isSafeInteger(Number(v.price)) || Number(v.price) < 0 || !Number.isFinite(Number(v.discountPercent ?? 0)) || Number(v.discountPercent ?? 0) < 0 || Number(v.discountPercent ?? 0) > 100)) {
      this.error.set('Vui lòng nhập tên, danh mục và thông tin SKU/giá hợp lệ.');
      return;
    }
    const normalized = this.variants.map(v => (v.sku ?? '').trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      this.error.set('SKU của các biến thể không được trùng nhau.');
      return;
    }
    // The original SKU is immutable: keep canonical BE data regardless of form edits.
    const originalSkuById = new Map(item.variants.map(v => [v.id, v.sku]));
    const body: ProductWrite = {
      name: this.name.trim(),
      description: this.description.trim(),
      categoryId: this.categoryId,
      usageType: this.usageType,
      productType: item.productType,
      images: this.imageSlots.map((image, index) => ({
        id: image.savedImage?.id ?? `img-${index + 1}`,
        url: image.savedImage?.url ?? '',
        isPrimary: index === 0,
        sortOrder: index,
      })),
      status: this.active ? 'ACTIVE' : 'INACTIVE',
      variants: this.variants.map(v => ({
        id: v.id, label: v.label.trim(), sku: originalSkuById.get(v.id!) ?? v.sku, price: Number(v.price), discountPercent: Number(v.discountPercent ?? 0), image: v.image ?? null, status: v.status,
      })),
    };
    this.saving.set(true);
    void this.updateWithUploads(item, body);
  }

  private async updateWithUploads(item: AdminProduct, body: ProductWrite): Promise<void> {
    try {
      const images: ProductImage[] = [];
      for (const image of this.imageSlots) {
        let url = image.savedImage?.url;
        let id = image.savedImage?.id;
        if (image.localFile) {
          const result = await firstValueFrom(this.api.uploadImages([image.localFile]).pipe(timeout({ first: 30000 })));
          url = result.items[0]?.url;
          id = result.items[0]?.id;
        }
        if (!url) throw new Error('Upload ảnh không trả về URL.');
        images.push({ id: id ?? `img-${images.length + 1}`, url, isPrimary: images.length === 0, sortOrder: images.length });
      }
      body.images = images;
      const updated = await firstValueFrom(this.api.updateProduct(item.id, body).pipe(timeout({ first: 30000 })));
      this.product.set(updated);
      this.name = updated.name;
      this.description = updated.description ?? '';
      this.categoryId = updated.categoryId;
      this.usageType = updated.usageType;
      this.active = updated.status === 'ACTIVE';
      this.imageSlots.forEach(image => this.releaseImagePreview(image));
      this.imageSlots = this.fromSavedImages(updated.images ?? []);
      this.variants = updated.variants.map(v => ({
        id: v.id, sku: v.sku, label: v.label, price: v.price, status: v.status, discountPercent: v.discountPercent, image: v.image,
      }));
      this.lastSavedSnapshot = this.draftSnapshot();
      this.success.set('Cập nhật sản phẩm thành công.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Không thể cập nhật sản phẩm.');
    } finally {
      this.saving.set(false);
    }
  }

  variantImagePreview(variant: ProductVariantWrite): string | null {
    return (variant.id ? this.variantImagePreviews.get(variant.id) : null) || variant.image || null;
  }

  selectVariantImage(event: Event, variantId: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.checkImage(file)) {
      this.imageError = file ? 'Chỉ nhận JPG, PNG tối đa 5MB.' : '';
      return;
    }
    const existingPreview = this.variantImagePreviews.get(variantId);
    if (existingPreview) URL.revokeObjectURL(existingPreview);
    this.variantImageFiles.set(variantId, file);
    this.variantImagePreviews.set(variantId, URL.createObjectURL(file));
    this.imageError = '';
  }

  toggleAddVariant(): void {
    if (this.saving() || !this.hasVariants || this.product()?.status === 'ARCHIVED') return;
    this.addVariantOpen.update(open => !open);
    this.variantActionError.set('');
  }

  async submitNewVariant(): Promise<void> {
    const product = this.product();
    if (!product || this.saving() || product.status === 'ARCHIVED' || !this.hasVariants) return;
    this.variantActionError.set('');
    if (this.hasUnsavedChanges()) {
      this.variantActionError.set('Vui lòng lưu các thay đổi hiện tại trước khi thêm biến thể.');
      return;
    }
    const label = this.newVariantLabel.trim();
    const price = Number(this.newVariantPrice);
    const discountPercent = Number(this.newVariantDiscount);
    if (!label || !Number.isSafeInteger(price) || price < 0 || !Number.isFinite(discountPercent) ||
        discountPercent < 0 || discountPercent > 100) {
      this.variantActionError.set('Nhập tên, giá hợp lệ và khuyến mại từ 0–100%.');
      return;
    }
    const body = { label, price, discountPercent, image: null, status: this.newVariantActive ? 'ACTIVE' as const : 'INACTIVE' as const };
    const fingerprint = JSON.stringify({ productId: product.id, ...body });
    if (fingerprint !== this.addVariantFingerprint) {
      this.addVariantFingerprint = fingerprint;
      this.addVariantKey = crypto.randomUUID();
    }
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(this.api.addVariant(product.id, body, this.addVariantKey).pipe(timeout({ first: 30000 })));
      this.applyUpdatedProduct(updated);
      this.addVariantKey = '';
      this.addVariantFingerprint = '';
      this.addVariantOpen.set(false);
      this.newVariantLabel = '';
      this.newVariantPrice = 0;
      this.newVariantDiscount = 0;
      this.newVariantActive = false;
      this.success.set('Đã thêm biến thể. SKU được Backend tự động sinh.');
    } catch (error) {
      this.variantActionError.set(
        (error instanceof Error ? error.message : 'Không thêm được biến thể.') +
        ' Nếu request hết thời gian chờ, kiểm tra danh sách biến thể trước khi thử lại.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  requestDeactivateVariant(variant: ProductVariantWrite): void {
    if (!variant.id || variant.status !== 'ACTIVE' || this.saving() || !this.hasVariants) return;
    this.variantActionError.set('');
    this.variantActionTarget.set(variant);
  }

  closeDeactivateVariant(): void {
    if (!this.saving()) this.variantActionTarget.set(null);
  }

  async confirmDeactivateVariant(): Promise<void> {
    const product = this.product(), variant = this.variantActionTarget();
    if (!product || !variant?.id || this.saving() || product.status === 'ARCHIVED') return;
    if (this.hasUnsavedChanges()) {
      this.variantActionError.set('Lưu các thay đổi đang chỉnh sửa trước khi ngừng biến thể.');
      return;
    }
    const key = this.deactivateKeys.get(variant.id) ?? crypto.randomUUID();
    this.deactivateKeys.set(variant.id, key);
    this.saving.set(true);
    this.variantActionError.set('');
    try {
      const updated = await firstValueFrom(this.api.deactivateVariant(product.id, variant.id, key).pipe(timeout({ first: 30000 })));
      this.deactivateKeys.delete(variant.id);
      this.applyUpdatedProduct(updated);
      this.variantActionTarget.set(null);
      this.success.set('Đã ngừng hoạt động biến thể. SKU và dữ liệu lịch sử vẫn được giữ.');
    } catch (error) {
      this.variantActionError.set(
        (error instanceof Error ? error.message : 'Không thể ngừng biến thể.') +
        ' Nếu chưa rõ kết quả, kiểm tra lại trạng thái biến thể trước khi thử lại.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  private applyUpdatedProduct(updated: AdminProduct): void {
    this.product.set(updated);
    this.name = updated.name;
    this.description = updated.description ?? '';
    this.categoryId = updated.categoryId;
    this.usageType = updated.usageType;
    this.active = updated.status === 'ACTIVE';
    this.imageSlots.forEach(image => this.releaseImagePreview(image));
    this.imageSlots = this.fromSavedImages(updated.images ?? []);
    this.variants = updated.variants.map(v => ({
      id: v.id, sku: v.sku, label: v.label, price: v.price,
      status: v.status, discountPercent: v.discountPercent, image: v.image,
    }));
    this.variantImagePreviews.forEach(url => URL.revokeObjectURL(url));
    this.variantImagePreviews.clear();
    this.variantImageFiles.clear();
    this.lastSavedSnapshot = this.draftSnapshot();
  }

  private checkImage(file: File): boolean {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.imageError = 'Chỉ hỗ trợ ảnh JPG hoặc PNG.';
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.imageError = 'Mỗi ảnh phải có dung lượng tối đa 5MB.';
      return false;
    }
    return true;
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.imageError = '';
    for (const file of files) {
      if (this.imageSlots.length >= 10) {
        this.imageError = 'Chỉ được chọn tối đa 10 ảnh sản phẩm.';
        break;
      }
      if (!this.checkImage(file)) continue;
      this.imageSlots = [...this.imageSlots, {
        id: this.nextImageId++,
        savedImage: null,
        previewUrl: URL.createObjectURL(file),
        localFile: file,
      }];
    }
  }

  replaceProductImage(event: Event, imageId: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.imageError = '';
    if (!this.checkImage(file)) return;
    const index = this.imageSlots.findIndex(image => image.id === imageId);
    if (index < 0) return;
    const oldImage = this.imageSlots[index];
    const newImage: EditableProductImage = {
      id: imageId, savedImage: null,
      previewUrl: URL.createObjectURL(file), localFile: file,
    };
    this.releaseImagePreview(oldImage);
    this.imageSlots = this.imageSlots.map(image => image.id === imageId ? newImage : image);
  }

  removeProductImage(imageId: number): void {
    const image = this.imageSlots.find(item => item.id === imageId);
    if (!image) return;
    this.releaseImagePreview(image);
    this.imageSlots = this.imageSlots.filter(item => item.id !== imageId);
    this.imageError = '';
  }

  setPrimaryImage(imageId: number): void {
    const index = this.imageSlots.findIndex(image => image.id === imageId);
    if (index <= 0) return;
    const images = [...this.imageSlots];
    const [selected] = images.splice(index, 1);
    this.imageSlots = [selected, ...images];
  }

  addVariant(): void {
    this.variants = [...this.variants, { label: '', sku: '', price: 0, status: 'INACTIVE' }];
  }

  removeVariant(index: number): void {
    if (this.variants.length > 1) this.variants = this.variants.filter((_, i) => i !== index);
  }
}
