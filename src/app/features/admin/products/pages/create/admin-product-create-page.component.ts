import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface ProductImageDraft {
  id: number;
  file: File | null;
  previewUrl: string | null;
  isDemo: boolean;
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
  imports: [FormsModule, RouterLink],
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
  // Figma's three checkerboard thumbnails are a visual demo state, not
  // uploaded files. They are replaced by real photos at the first upload.
  images: ProductImageDraft[] = [
    { id: 1, file: null, previewUrl: null, isDemo: true },
    { id: 2, file: null, previewUrl: null, isDemo: true },
    { id: 3, file: null, previewUrl: null, isDemo: true },
  ];
  primaryImageId: number | null = 1;
  feedback = '';

  variants: VariantDraft[] = [
    this.newVariant('500g', 250000),
    this.newVariant('1.5kg', 420000),
  ];

  private nextImageId = 4;
  private readonly maxImageCount = 10;
  private readonly maxImageSize = 5 * 1024 * 1024;

  get emptyPreviewSlots(): number[] {
    return Array.from(
      { length: Math.max(0, 3 - this.images.length) },
      (_, index) => index,
    );
  }

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
    const realImages = this.images.filter(image => !image.isDemo);
    const allowed = validFiles.slice(
      0,
      Math.max(0, this.maxImageCount - realImages.length),
    );

    if (allowed.length > 0) {
      // Never treat Figma's visual demo images as uploaded product files.
      this.images = realImages;
      if (!this.images.some(image => image.id === this.primaryImageId)) {
        this.primaryImageId = null;
      }
    }

    for (const file of allowed) {
      this.images.push({
        id: this.nextImageId++,
        file,
        previewUrl: URL.createObjectURL(file),
        isDemo: false,
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

  removeProductImage(id: number): void {
    const index = this.images.findIndex(image => image.id === id);
    if (index === -1) return;
    const [removed] = this.images.splice(index, 1);
    if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
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
    this.images.forEach(image => {
      if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    });
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
