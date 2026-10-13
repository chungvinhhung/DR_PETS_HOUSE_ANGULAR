import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface VariantDraft { label: string; sku: string; price: number; discount: number; active: boolean; }
@Component({
  selector: 'app-admin-product-create-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-product-create-page.component.html',
  styleUrl: './admin-product-create-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AdminProductCreatePageComponent {
  productName = '';
  categoryId = '';
  usageType = '';
  description = '';
  hasVariants = true;
  active = false;
  images: string[] = [];
  feedback = '';
  variants: VariantDraft[] = [
    { label: '500g', sku: '', price: 250000, discount: 0, active: false },
    { label: '1.5kg', sku: '', price: 420000, discount: 0, active: false },
  ];
  get priceRange(): string {
    const prices = this.variants.map(v => Number(v.price) || 0);
    if (!prices.length) return '0đ';
    return `${Math.min(...prices).toLocaleString('vi-VN')}đ – ${Math.max(...prices).toLocaleString('vi-VN')}đ`;
  }
  finalPrice(v: VariantDraft): number {
    return Math.round(Math.max(0, Number(v.price) || 0) * (1 - Math.min(100, Math.max(0, Number(v.discount) || 0)) / 100));
  }
  selectVariantMode(value: boolean): void {
    this.hasVariants = value;
    if (!value) this.variants = [{ label: 'Mặc định', sku: '', price: 0, discount: 0, active: false }];
    else if (this.variants.length === 1 && this.variants[0].label === 'Mặc định')
      this.variants = [{ label: '', sku: '', price: 0, discount: 0, active: false }];
  }
  addVariant(): void { this.variants.push({ label: '', sku: '', price: 0, discount: 0, active: false }); }
  removeVariant(index: number): void {
    if (this.variants.length > 1) this.variants.splice(index, 1);
  }
  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const allowed = files.filter(f => /image\/(jpeg|png)/.test(f.type) && f.size <= 5 * 1024 * 1024);
    if (allowed.length !== files.length) this.feedback = 'Chỉ hỗ trợ ảnh JPG/PNG tối đa 5MB.';
    const accepted = allowed.slice(0, Math.max(0, 10 - this.images.length));
    for (const file of accepted) {
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === 'string') this.images.push(reader.result); };
      reader.readAsDataURL(file);
    }
    input.value = '';
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