import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { ServiceBookingMode } from '../models/service-catalog.model';
import {
  ServiceCatalogApiService, ServiceDetail, ServicePriceVariant, ServiceWrite,
} from '../services/service-catalog-api.service';

type PriceMode = 'FIXED' | 'QUOTE';
type Tier = { key: string; weight: string; mode: PriceMode; price: number | null };
type MaterialLine = { key: number; sku: string; query: string; quantity: number | null; unit: string };
const TIER_WEIGHTS = [
  { key: 'XS', weight: '< 5 kg' },
  { key: 'S', weight: '5 – < 10 kg' },
  { key: 'M', weight: '10 – < 20 kg' },
  { key: 'L', weight: '20 – 30 kg' },
  { key: 'XL', weight: '> 30 kg' },
] as const;

@Component({
  selector: 'app-service-catalog-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './service-catalog-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCatalogEditorComponent {
  private readonly api = inject(ServiceCatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly createKey = crypto.randomUUID();

  readonly editorMode = (this.route.snapshot.data['editorMode'] ?? 'create') as 'create' | 'edit' | 'view';
  readonly serviceId = this.route.snapshot.paramMap.get('id');
  readonly source = signal<ServiceDetail | null>(null);
  readonly loading = signal(this.editorMode !== 'create');
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly readOnly = this.editorMode === 'view' || this.authSession.user()?.systemRole !== 'ADMIN';
  readonly isNew = this.editorMode === 'create';
  readonly title = this.editorMode === 'view' ? 'Chi tiết dịch vụ' : this.isNew ? 'Thêm dịch vụ' : 'Chỉnh sửa dịch vụ';

  serviceName = '';
  category = 'GROOMING';
  bookingMode: ServiceBookingMode = 'BOOKABLE';
  description = '';
  durationMinutes: number | null = 60;
  executorRole: 'CARE_STAFF_GROOMER' | 'NURSE' | 'VETERINARIAN' = 'CARE_STAFF_GROOMER';
  active = true;
  weightPricing = false;
  priceTiers: Tier[] = TIER_WEIGHTS.map((item) => ({
    ...item, mode: item.key === 'XL' ? 'QUOTE' : 'FIXED', price: null,
  }));
  /** Material references supplied by BE are visible but immutable until InventoryItem ID lookup is integrated. */
  materials: MaterialLine[] = [];

  readonly errors = signal<string[]>([]);
  readonly notice = signal('');
  readonly dirty = signal(false);
  readonly showCancelConfirmation = signal(false);

  constructor() {
    if (!this.isNew && this.serviceId) {
      this.api.get(this.serviceId).pipe(takeUntilDestroyed()).subscribe({
        next: (service) => {
          this.populate(service);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loadError.set(this.messageForError(error, 'Không tải được chi tiết dịch vụ.'));
          this.loading.set(false);
        },
      });
    } else if (!this.isNew) {
      this.loadError.set('Đường dẫn thiếu mã dịch vụ.');
      this.loading.set(false);
    }
  }

  get missingService(): boolean {
    return !this.isNew && !this.loading() && !!this.loadError();
  }

  get mayEdit(): boolean {
    return !this.readOnly && !this.loading() && !this.missingService && !this.saving();
  }

  private populate(detail: ServiceDetail): void {
    this.source.set(detail);
    this.serviceName = detail.name;
    this.category = detail.serviceType;
    this.bookingMode = detail.bookingMode;
    this.description = detail.description ?? '';
    this.durationMinutes = detail.durationMinutes;
    this.executorRole = detail.requiredStaffRole;
    this.active = detail.status === 'ACTIVE';
    this.weightPricing = (detail.priceVariants?.length ?? 0) > 0;
    this.priceTiers = TIER_WEIGHTS.map((item) => {
      const current = detail.priceVariants?.find((tier) => tier.label === item.key);
      const value = current?.price ?? (!this.weightPricing && item.key === 'XS' ? detail.basePrice : null);
      return {
        ...item,
        mode: value !== null && value > 0 ? 'FIXED' as PriceMode : 'QUOTE' as PriceMode,
        price: value,
      };
    });
    // Never replace BE InventoryItem IDs with illustrative SKU codes or silently discard material refs.
    this.materials = (detail.defaultMaterials ?? []).map((line, index) => ({
      key: index + 1,
      sku: line.materialId,
      query: line.materialId,
      quantity: line.defaultQuantity,
      unit: line.unit,
    }));
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
    // BE requires durationMinutes >= 1 for every booking mode, including CONTACT_ONLY.
    this.markDirty();
  }

  setTierMode(tier: Tier, mode: PriceMode): void {
    if (tier.key === 'XL') return; // over 30 kg is quote only
    tier.mode = mode;
    if (mode === 'QUOTE') tier.price = null;
    this.markDirty();
  }

  toggleStatus(): void {
    this.active = !this.active;
    this.markDirty();
  }

  private validate(): string[] {
    const messages: string[] = [];
    const name = this.serviceName.trim();
    if (name.length < 2 || name.length > 120) messages.push('Tên dịch vụ phải có từ 2 đến 120 ký tự.');
    if (this.category !== 'GROOMING' && this.category !== 'MEDICAL') messages.push('Vui lòng chọn loại dịch vụ.');
    if (!['BOOKABLE', 'REQUEST_ONLY', 'CONTACT_ONLY'].includes(this.bookingMode)) messages.push('Hình thức đặt lịch không hợp lệ.');
    if (this.category === 'GROOMING' && this.executorRole !== 'CARE_STAFF_GROOMER') {
      messages.push('Dịch vụ Grooming phải dùng vai trò CARE STAFF GROOMER.');
    }
    if (this.category === 'MEDICAL' && !['VETERINARIAN', 'NURSE'].includes(this.executorRole)) {
      messages.push('Dịch vụ Medical phải dùng vai trò VETERINARIAN hoặc NURSE.');
    }
    if (!Number.isSafeInteger(this.durationMinutes) || (this.durationMinutes ?? 0) < 1) {
      messages.push('Thời lượng phải là số nguyên dương.');
    }
    if (/(phẫu thuật|triệt sản|surgery|mổ)/i.test(name) && this.bookingMode !== 'REQUEST_ONLY') {
      messages.push('Phẫu thuật chỉ hỗ trợ REQUEST_ONLY.');
    }
    if (/(cấp cứu|emergency)/i.test(name) && this.bookingMode !== 'CONTACT_ONLY') {
      messages.push('Cấp cứu chỉ hỗ trợ CONTACT_ONLY.');
    }

    for (const tier of this.weightPricing ? this.priceTiers.filter((t) => t.key !== 'XL') : this.priceTiers.slice(0, 1)) {
      if (tier.mode === 'FIXED' && (!Number.isFinite(tier.price) || (tier.price ?? 0) <= 0)) {
        messages.push('Mức ' + tier.key + ': vui lòng nhập giá cố định lớn hơn 0.');
      }
    }
    return [...new Set(messages)];
  }

  private toWrite(): ServiceWrite {
    const priceVariants: ServicePriceVariant[] = this.weightPricing
      ? this.priceTiers.filter((t) => t.key !== 'XL' && t.mode === 'FIXED' && t.price !== null).map((tier) => {
        const ranges: Record<string, { minWeightKg?: number; maxWeightKg?: number }> = {
          XS: { minWeightKg: 0, maxWeightKg: 5 },
          S: { minWeightKg: 5, maxWeightKg: 10 },
          M: { minWeightKg: 10, maxWeightKg: 20 },
          L: { minWeightKg: 20, maxWeightKg: 30 },
        };
        return { label: tier.key, ...ranges[tier.key], price: tier.price! };
      })
      : [];
    const basePrice = this.weightPricing
      ? (priceVariants.length ? Math.min(...priceVariants.map((t) => t.price)) : 0)
      : this.priceTiers[0].mode === 'FIXED' ? (this.priceTiers[0].price ?? 0) : 0;
    return {
      name: this.serviceName.trim(),
      serviceType: this.category as ServiceWrite['serviceType'],
      category: this.source()?.serviceType === this.category && this.source()?.category
        ? this.source()!.category : this.category,
      description: this.description.trim(),
      bookingMode: this.bookingMode,
      requiredStaffRole: this.executorRole,
      durationMinutes: this.durationMinutes!,
      basePrice,
      priceVariants,
      status: this.active ? 'ACTIVE' : 'INACTIVE',
      // No defaultMaterials overwrite until an actual inventory item selector exists.
    };
  }

  save(): void {
    if (!this.mayEdit) return;
    const failures = this.validate();
    this.errors.set(failures);
    if (failures.length) {
      this.toast.show(failures.slice(0, 2).join(' '));
      return;
    }
    const body = this.toWrite();
    const request = this.isNew
      ? this.api.create(body, this.createKey)
      : this.api.update(this.serviceId!, body);
    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.dirty.set(false);
        this.toast.show(this.isNew ? 'Đã thêm dịch vụ.' : 'Đã lưu dịch vụ.', 'success');
        void this.router.navigateByUrl('/admin/services');
      },
      error: (error: unknown) => {
        const message = this.messageForError(error, 'Không lưu được dịch vụ. Vui lòng thử lại.');
        this.notice.set(message);
        this.toast.show(message);
      },
    });
  }

  private messageForError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 403) return 'Tài khoản không có quyền thay đổi danh mục dịch vụ.';
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.status === 0) return 'Không kết nối được Backend. Kiểm tra Render hoặc kết nối mạng.';
    const body = error.error as { message?: string; error?: { message?: string }; EM?: string } | null;
    return body?.error?.message || body?.message || body?.EM || fallback;
  }

  cancel(): void {
    if (this.dirty() && this.mayEdit) this.showCancelConfirmation.set(true);
    else void this.router.navigateByUrl('/admin/services');
  }

  confirmCancel(): void {
    this.showCancelConfirmation.set(false);
    void this.router.navigateByUrl('/admin/services');
  }
}
