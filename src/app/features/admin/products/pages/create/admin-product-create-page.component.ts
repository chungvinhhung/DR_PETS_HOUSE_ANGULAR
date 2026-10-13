import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
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
export class AdminProductCreatePageComponent implements OnDestroy {
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

  variants: VariantDraft[] = [
    this.newVariant('500g', 250000),
    this.newVariant('1.5kg', 420000),
  ];

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

  ngOnDestroy(): void {
    this.images.forEach(image => URL.revokeObjectURL(image.previewUrl));
    this.variants.forEach(variant => this.releaseVariantImage(variant));
  }

  saveDraft(): void {
    if (!this.productName.trim() || !this.categoryId.trim() || !this.usageType.trim()
      || this.variants.some(v => !v.label.trim() || !v.sku.trim() || Number(v.price) < 0)) {
      this.feedback = 'Vui lòng nhập tên, loại sử dụng, danh mục và đầy đủ SKU/giá biến thể.';
      return;
    }
    this.feedback = 'Phase 1: Giao diện đã kiểm tra dữ liệu. Chức năng lưu API sẽ được kết nối ở phase tích hợp Backend.';
  }
}
