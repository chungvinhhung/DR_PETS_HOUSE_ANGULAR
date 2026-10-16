import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { CatalogService, ServiceApiRecord, ServiceBookingMode, ServicePriceVariant, ServiceWrite } from '../models/service-catalog.model';
import { ServiceCatalogApiService, serviceFromApi } from '../services/service-catalog-api.service';

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

// BE requires InventoryItem ObjectIds, not Product SKU strings.
const INVENTORY_OPTIONS: readonly MaterialOption[] = [];

@Component({
  selector: 'app-service-catalog-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './service-catalog-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCatalogEditorComponent {
  private readonly repository = inject(ServiceCatalogApiService);
  private readonly destroyRef = inject(DestroyRef);
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
  source: CatalogService | null = null;
  readonly loading = signal(this.editorMode !== 'create');
  readonly missingService = signal(false);
  readonly saving = signal(false);
  private pricingDirty = false;
  private saveIdempotencyKey: string | null = null;
  readonly readOnly = this.editorMode === 'view' || this.authSession.user()?.systemRole !== 'ADMIN';
  readonly isNew = this.editorMode === 'create';
  readonly title = this.editorMode === 'view' ? 'Chi tiết dịch vụ' : this.isNew ? 'Thêm dịch vụ' : 'Chỉnh sửa dịch vụ';
  readonly productOptions = INVENTORY_OPTIONS;

  serviceName = '';
  category = 'GROOMING';
  bookingMode: ServiceBookingMode = 'BOOKABLE';
  description = '';
  durationMinutes: number | null = 60;
  executorRole = 'CARE_STAFF_GROOMER';
  active = true;
  weightPricing = true;
  priceTiers: Tier[] = TIER_WEIGHTS.map((item) => ({
    ...item, mode: 'FIXED', price: null,
  }));
  materials: MaterialLine[] = [];
  private nextMaterialKey = 1;

  readonly errors = signal<string[]>([]);
  readonly notice = signal('');
  readonly dirty = signal(false);
  readonly showCancelConfirmation = signal(false);

  constructor() {
    if (this.serviceId && this.editorMode !== 'create') {
      this.repository.get(this.serviceId).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: (raw) => {
          this.hydrate(raw);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.missingService.set(true);
          this.errors.set([this.errorLabel(error)]);
        },
      });
    }
  }

  private hydrate(raw: ServiceApiRecord): void {
    this.source = serviceFromApi(raw);
    this.serviceName = raw.name;
    this.category = raw.serviceType;
    this.bookingMode = raw.bookingMode;
    this.description = raw.description ?? '';
    this.durationMinutes = raw.durationMinutes;
    this.executorRole = raw.requiredStaffRole;
    this.active = raw.status === 'ACTIVE';
    const variants = raw.priceVariants ?? [];
    this.weightPricing = variants.length > 0;
    this.priceTiers = TIER_WEIGHTS.map((t) => {
      const found = variants.find((v) => v.label === t.key);
      return {
        ...t,
        mode: found ? 'FIXED' as const : 'QUOTE' as const,
        price: found?.price ?? null,
      };
    });
    if (!this.weightPricing) {
      this.priceTiers[0].mode = 'FIXED';
      this.priceTiers[0].price = raw.basePrice;
    }
    // InventoryItem.materialId is NOT a Product SKU. Preserve existing
    // materials server-side and show them read-only until Inventory lookup is ready.
    this.materials = (raw.defaultMaterials ?? []).map((m) => ({
      key: this.nextMaterialKey++,
      sku: m.materialId,
      query: m.materialId,
      quantity: m.defaultQuantity,
      unit: m.unit,
    }));
  }

  private errorLabel(error: HttpErrorResponse): string {
    const body = error.error as { message?: string; error?: { message?: string }; code?: string } | null;
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.status === 403) return 'Tài khoản không có quyền thao tác danh mục dịch vụ.';
    if (error.status === 404) return 'Không tìm thấy dịch vụ trong Backend.';
    if (error.status === 409) return 'Dữ liệu đã thay đổi hoặc mã dịch vụ bị trùng. Vui lòng kiểm tra và thử lại.';
    if (error.status === 422 || error.status === 400)
      return body?.message ?? body?.error?.message ?? 'Dữ liệu không hợp lệ theo quy tắc Backend.';
    return 'Không kết nối được Backend. Vui lòng kiểm tra lại hoặc thử sau.';
  }

  get mayEdit(): boolean {
    return !this.readOnly && !this.missingService() && !this.loading() && !this.saving();
  }

  markDirty(): void {
    this.dirty.set(true);
    this.notice.set('');
    if (this.errors().length) this.errors.set([]);
  }

  changeCategory(category: string): void {
    this.category = category;
    this.executorRole = category === 'GROOMING' ? 'CARE_STAFF_GROOMER' : 'VETERINARIAN';
    this.markDirty();
  }

  changeBookingMode(mode: ServiceBookingMode): void {
    this.bookingMode = mode;
    // ServiceWrite.durationMinutes is required >= 1 for all booking modes, including CONTACT_ONLY.
    if (this.durationMinutes === null) this.durationMinutes = 30;
    this.markDirty();
  }

  setTierMode(tier: Tier, mode: PriceMode): void {
    tier.mode = mode;
    if (mode === 'QUOTE') tier.price = null;
    this.markPricingDirty();
  }

  markPricingDirty(): void {
    this.pricingDirty = true;
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
    if (!['CARE_STAFF_GROOMER', 'VETERINARIAN', 'NURSE'].includes(this.executorRole)) {
      messages.push('Vai trò thực hiện không hợp lệ.');
    }
    if (!Number.isSafeInteger(this.durationMinutes) || (this.durationMinutes ?? 0) <= 0) {
      messages.push('Thời lượng phải là số nguyên dương, kể cả dịch vụ chỉ liên hệ.');
    }
    if (/phẫu thuật|triệt sản|mổ/i.test(this.serviceName) && this.bookingMode !== 'REQUEST_ONLY') {
      messages.push('Phẫu thuật chỉ được tiếp nhận theo yêu cầu (REQUEST_ONLY).');
    }
    if (/cấp cứu/i.test(this.serviceName) && this.bookingMode !== 'CONTACT_ONLY') {
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

    return [...new Set(messages)];
  }

  private pricePayload(): { basePrice: number; priceVariants: ServicePriceVariant[] } {
    if (!this.weightPricing) {
      return { basePrice: this.priceTiers[0].mode === 'FIXED' ? this.priceTiers[0].price ?? 0 : 0, priceVariants: [] };
    }
    const bounds: Record<string, [number | undefined, number | undefined]> = {
      XS: [undefined, 5], S: [5, 10], M: [10, 20], L: [20, 30], XL: [30, undefined],
    };
    const priceVariants = this.priceTiers.filter((t) => t.mode === 'FIXED' && t.price !== null)
      .map((t) => {
        const [minWeightKg, maxWeightKg] = bounds[t.key] ?? [];
        return {
          label: t.key, price: t.price!,
          ...(minWeightKg === undefined ? {} : { minWeightKg }),
          ...(maxWeightKg === undefined ? {} : { maxWeightKg }),
        };
      });
    return { basePrice: priceVariants.length ? Math.min(...priceVariants.map((v) => v.price)) : 0, priceVariants };
  }

  validateDraft(): void {
    if (!this.mayEdit) return;
    const errors = this.validate();
    this.errors.set(errors);
    if (errors.length) {
      this.notice.set('');
      return;
    }
    const prices = this.pricePayload();
    const body: ServiceWrite = {
      name: this.serviceName.trim(),
      serviceType: this.category as 'GROOMING' | 'MEDICAL',
      category: this.category,
      description: this.description.trim(),
      bookingMode: this.bookingMode,
      requiredStaffRole: this.executorRole as ServiceWrite['requiredStaffRole'],
      durationMinutes: this.durationMinutes!,
      status: this.active ? 'ACTIVE' : 'INACTIVE',
      ...prices,
    };
    // Never send Product SKU strings as InventoryItem IDs.
    // On EDIT, leave existing defaultMaterials untouched in Backend.
    this.saving.set(true);
    const request = this.isNew
      ? this.repository.create(body, this.saveIdempotencyKey ??= crypto.randomUUID())
      : this.repository.update(this.serviceId!, this.pricingDirty
        ? body : (({ basePrice: _price, priceVariants: _variants, ...rest }) => rest)(body));
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.dirty.set(false);
        this.notice.set(this.isNew ? 'Đã thêm dịch vụ thành công.' : 'Đã cập nhật dịch vụ thành công.');
        void this.router.navigateByUrl('/admin/services');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errors.set([this.errorLabel(error)]);
      },
    });
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
