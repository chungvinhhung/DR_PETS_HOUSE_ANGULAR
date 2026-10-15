import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { ServiceBookingMode } from '../models/service-catalog.model';
import { ServiceCatalogMockRepository } from '../services/service-catalog-mock.repository';

type PriceMode = 'FIXED' | 'QUOTE';
type Tier = { key: string; weight: string; mode: PriceMode; price: number | null };
type MaterialOption = { sku: string; name: string; unit: string };
type MaterialLine = { key: number; sku: string; query: string; quantity: number | null; unit: string };
const TIER_WEIGHTS = [
  { key: 'XS', weight: '< 5 kg' },
  { key: 'S', weight: '5 – < 10 kg' },
  { key: 'M', weight: '10 – < 20 kg' },
  { key: 'L', weight: '20 – 30 kg' },
  { key: 'XL', weight: '> 30 kg' },
] as const;

const DEMO_PRODUCT_SKUS: readonly MaterialOption[] = [
  { sku: 'MAT014', name: 'Dầu gội Grooming / Shampoo', unit: 'ml' },
  { sku: 'MAT015', name: 'Dầu xả / Conditioner', unit: 'ml' },
  { sku: 'MAT016', name: 'Dung dịch vệ sinh tai', unit: 'ml' },
  { sku: 'MAT002', name: 'Bông tẩy trang / Cotton pad', unit: 'miếng' },
  { sku: 'MAT018', name: 'Bông băng y tế', unit: 'cuộn' },
];

@Component({
  selector: 'app-service-catalog-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './service-catalog-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCatalogEditorComponent {
  private readonly repository = inject(ServiceCatalogMockRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly validateErrorToast = effect(() => {
    const errors = this.errors();
    if (errors.length) this.toast.show(errors.slice(0, 2).join(' '));
  });
  private readonly previewToast = effect(() => {
    const message = this.notice();
    if (message) this.toast.show(message, 'info');
  });

  readonly editorMode = (this.route.snapshot.data['editorMode'] ?? 'create') as 'create' | 'edit' | 'view';
  readonly serviceId = this.route.snapshot.paramMap.get('id');
  readonly source = this.serviceId ? this.repository.getById(this.serviceId) : null;
  readonly missingService = this.editorMode !== 'create' && !this.source;
  readonly readOnly = this.editorMode === 'view' || this.authSession.user()?.systemRole !== 'ADMIN';
  readonly isNew = this.editorMode === 'create';
  readonly title = this.editorMode === 'view' ? 'Chi tiết dịch vụ' : this.isNew ? 'Thêm dịch vụ' : 'Chỉnh sửa dịch vụ';
  readonly productOptions = DEMO_PRODUCT_SKUS;

  serviceName = this.source?.name ?? '';
  category = this.source?.category ?? 'GROOMING';
  bookingMode: ServiceBookingMode = this.source?.bookingMode ?? 'BOOKABLE';
  description = '';
  durationMinutes: number | null = this.source?.durationMinutes ?? 60;
  executorRole = this.source?.executorRole === 'VETERINARIAN' ? 'VETERINARIAN' : 'CARE_STAFF';
  active = this.source?.status !== 'INACTIVE';
  weightPricing = true;
  priceTiers: Tier[] = TIER_WEIGHTS.map((item, index) => ({
    ...item,
    mode: this.source?.minFixedTierPrice === null && this.source?.referencePrice === null ? 'QUOTE' : 'FIXED',
    price: this.source ? (this.source.minFixedTierPrice ?? this.source.referencePrice ?? null) : null,
  }));
  materials: MaterialLine[] = [];
  private nextMaterialKey = 1;

  readonly errors = signal<string[]>([]);
  readonly notice = signal('');
  readonly dirty = signal(false);
  readonly showCancelConfirmation = signal(false);

  constructor() {
    if (this.source?.category === 'GROOMING') {
      for (const product of DEMO_PRODUCT_SKUS.slice(0, 4)) {
        this.materials.push({
          key: this.nextMaterialKey++,
          sku: product.sku,
          query: product.name,
          quantity: 1,
          unit: product.unit,
        });
      }
    }

    if (this.source?.bookingMode === 'CONTACT_ONLY') {
      this.durationMinutes = null;
    }
  }

  get mayEdit(): boolean {
    return !this.readOnly && !this.missingService;
  }

  markDirty(): void {
    this.dirty.set(true);
    this.notice.set('');
    if (this.errors().length) this.errors.set([]);
  }

  changeCategory(category: string): void {
    this.category = category;
    this.executorRole = category === 'GROOMING' ? 'CARE_STAFF' : 'VETERINARIAN';
    this.markDirty();
  }

  changeBookingMode(mode: ServiceBookingMode): void {
    this.bookingMode = mode;
    if (mode === 'CONTACT_ONLY') this.durationMinutes = null;
    if (mode === 'BOOKABLE' && this.durationMinutes === null) this.durationMinutes = 30;
    this.markDirty();
  }

  setTierMode(tier: Tier, mode: PriceMode): void {
    tier.mode = mode;
    if (mode === 'QUOTE') tier.price = null;
    this.markDirty();
  }

  addMaterial(): void {
    this.materials.push({
      key: this.nextMaterialKey++, sku: '', query: '', quantity: null, unit: '',
    });
    this.markDirty();
  }

  removeMaterial(key: number): void {
    this.materials = this.materials.filter((line) => line.key !== key);
    this.markDirty();
  }

  matchProduct(line: MaterialLine, text: string): void {
    line.query = text;
    const normalized = text.trim().toLocaleLowerCase('vi');
    const product = this.productOptions.find((item) =>
      item.name.toLocaleLowerCase('vi') === normalized || item.sku.toLocaleLowerCase('vi') === normalized);
    line.sku = product?.sku ?? '';
    if (product && !line.unit) line.unit = product.unit;
    this.markDirty();
  }

  toggleStatus(): void {
    this.active = !this.active;
    this.markDirty();
  }

  private validate(): string[] {
    const messages: string[] = [];
    if (this.serviceName.trim().length < 2 || this.serviceName.trim().length > 120) {
      messages.push('Tên dịch vụ phải có từ 2 đến 120 ký tự.');
    }
    if (!['GROOMING', 'MEDICAL'].includes(this.category)) messages.push('Vui lòng chọn loại dịch vụ.');
    if (!['BOOKABLE', 'REQUEST_ONLY', 'CONTACT_ONLY'].includes(this.bookingMode)) {
      messages.push('Vui lòng chọn hình thức đặt lịch.');
    }
    if (!['CARE_STAFF', 'VETERINARIAN'].includes(this.executorRole)) {
      messages.push('Vai trò thực hiện không hợp lệ.');
    }
    if (this.bookingMode !== 'CONTACT_ONLY' &&
      (!Number.isSafeInteger(this.durationMinutes) || (this.durationMinutes ?? 0) <= 0)) {
      messages.push('Thời lượng phải là số nguyên dương, trừ dịch vụ chỉ liên hệ.');
    }
    if (this.source?.serviceCode === 'MED06' && this.bookingMode !== 'REQUEST_ONLY') {
      messages.push('Phẫu thuật chỉ được tiếp nhận theo yêu cầu (REQUEST_ONLY).');
    }
    if (this.source?.serviceCode === 'MED07' && this.bookingMode !== 'CONTACT_ONLY') {
      messages.push('Cấp cứu chỉ cho liên hệ (CONTACT_ONLY).');
    }

    if (this.weightPricing) {
      for (const tier of this.priceTiers) {
        if (tier.mode === 'FIXED' && (tier.price === null ||
          !Number.isSafeInteger(tier.price) || tier.price <= 0)) {
          messages.push('Mức ' + tier.key + ': giá cố định phải là số nguyên dương.');
        }
      }
    } else if (this.priceTiers[0].mode === 'FIXED' &&
      (this.priceTiers[0].price === null || !Number.isSafeInteger(this.priceTiers[0].price) ||
      this.priceTiers[0].price <= 0)) {
      messages.push('Giá dịch vụ phải là số nguyên dương hoặc chọn Liên hệ báo giá.');
    }

    const materialSkus = new Set<string>();
    for (const line of this.materials) {
      if (!line.sku || !this.productOptions.some((item) => item.sku === line.sku)) {
        messages.push('Một vật liệu chưa được chọn từ danh sách SKU hiện có.');
      } else if (materialSkus.has(line.sku)) {
        messages.push('Không được chọn trùng SKU vật liệu: ' + line.sku + '.');
      } else {
        materialSkus.add(line.sku);
      }
      if (line.quantity === null || !Number.isFinite(line.quantity) || line.quantity <= 0) {
        messages.push('Số lượng vật liệu phải lớn hơn 0.');
      }
      if (!line.unit.trim()) messages.push('Đơn vị vật liệu không được để trống.');
    }
    return [...new Set(messages)];
  }

  validateDraft(): void {
    if (!this.mayEdit) return;
    const errors = this.validate();
    this.errors.set(errors);
    if (errors.length) {
      this.notice.set('');
      return;
    }

    this.notice.set('Dữ liệu hợp lệ, nhưng chưa lưu lên Backend. API Service CRUD chưa được bàn giao; đây chỉ là bản xem trước Phase 2.');
  }

  cancel(): void {
    if (this.dirty() && this.mayEdit) {
      this.showCancelConfirmation.set(true);
    } else {
      void this.router.navigateByUrl('/admin/services');
    }
  }

  confirmCancel(): void {
    this.showCancelConfirmation.set(false);
    void this.router.navigateByUrl('/admin/services');
  }
}
