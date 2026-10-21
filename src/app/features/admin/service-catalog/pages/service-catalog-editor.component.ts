import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AppHttpError } from '../../../../core/models/app-http-error.model';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { CatalogService, ServiceApiRecord, ServiceBookingMode, ServicePriceVariant, ServiceWrite } from '../models/service-catalog.model';
import { ServiceCatalogApiService, serviceFromApi } from '../services/service-catalog-api.service';
import { resolveServicePricing } from '../services/service-pricing.utils';
import { AdminProductService } from '../../products/services/admin-product.service';
import { AdminCategoryService } from '../../categories/services/admin-category.service';

type PriceMode = 'FIXED' | 'QUOTE';
type Tier = { key: string; weight: string; mode: PriceMode; price: number | null };
type MaterialOption = { sku: string; name: string; unit: string; image: string | null; categoryId: string; price: number };
type MaterialLine = { key: number; sku: string; query: string; quantity: number | null; unit: string };
type BranchDetailRow = { id: string; name: string; summary: string };
const TIER_WEIGHTS = [
  { key: 'XS', weight: '< 5 kg' },
  { key: 'S', weight: '5 – < 10 kg' },
  { key: 'M', weight: '10 – < 20 kg' },
  { key: 'L', weight: '20 – 30 kg' },
  { key: 'XL', weight: '> 30 kg' },
] as const;

// BE requires InventoryItem ObjectIds, not Product SKU strings.


@Component({
  selector: 'app-service-catalog-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './service-catalog-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCatalogEditorComponent {
  private readonly repository = inject(ServiceCatalogApiService);
  private readonly productsApi = inject(AdminProductService);
  private readonly categoryApi = inject(AdminCategoryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly previewToast = effect(() => {
    const message = this.notice();
    if (message) this.toast.show(message, 'info');
  });

  readonly editorMode = (this.route.snapshot.data['editorMode'] ?? 'create') as 'create' | 'edit' | 'view';
  readonly serviceId = this.route.snapshot.paramMap.get('id');
  // Only allow the current service detail route or the catalog list as a return destination.
  // Never navigate to an arbitrary URL supplied through query parameters.
  readonly returnUrl = this.resolveReturnUrl();

  private resolveReturnUrl(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnTo');
    if (requested === '/admin/services') return requested;
    if (this.serviceId && requested === `/admin/services/${encodeURIComponent(this.serviceId)}`) {
      return requested;
    }
    return '/admin/services';
  }

  back(): void {
    void this.router.navigateByUrl(this.returnUrl);
  }
  source: CatalogService | null = null;
  readonly branchDetailRows = signal<readonly BranchDetailRow[]>([]);
  readonly branchesLoading = signal(false);
  readonly branchLoadError = signal('');
  readonly loading = signal(this.editorMode !== 'create');
  readonly missingService = signal(false);
  readonly saving = signal(false);
  private pricingDirty = false;
  pricingDataWarning = false;
  private saveIdempotencyKey: string | null = null;
  get authSessionRole(): string | undefined {
    return this.authSession.user()?.systemRole ?? this.authSession.roles()[0];
  }

  get readOnly(): boolean {
    return this.editorMode === 'view' || this.authSessionRole !== 'ADMIN';
  }
  readonly isNew = this.editorMode === 'create';
  readonly title = this.editorMode === 'view' ? 'Chi tiết dịch vụ' : this.isNew ? 'Thêm dịch vụ' : 'Chỉnh sửa dịch vụ';
  productOptions: MaterialOption[] = [];
  readonly productCategoryNames = new Map<string, string>();
  readonly openMaterialKey = signal<number | null>(null);
  private materialsDirty = false;

  serviceName = '';
  // Create starts unselected; edit/view are hydrated from the API.
  category = '';
  bookingMode: ServiceBookingMode | '' = '';
  description = '';
  durationMinutes: number | null = null;
  executorRole = '';
  active = true;
  weightPricing = false;
  readonly materialUnits = ['cái', 'chai', 'gói', 'hộp', 'lọ', 'viên', 'ml', 'l', 'g', 'kg'] as const;
  priceTiers: Tier[] = TIER_WEIGHTS.map((item) => ({
    ...item, mode: 'QUOTE', price: null,
  }));
  materials: MaterialLine[] = [];
  private nextMaterialKey = 1;

  readonly errors = signal<string[]>([]);
  readonly notice = signal('');
  readonly dirty = signal(false);
  readonly showCancelConfirmation = signal(false);

  constructor() {
    this.categoryApi.listCategories({ limit: 100 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        for (const category of page.items) this.productCategoryNames.set(category.id, category.name);
      },
    });
    this.productsApi.listProducts({ limit: 100, status: 'ACTIVE' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.productOptions = page.items.flatMap((product) => product.variants
          .filter((variant) => variant.status === 'ACTIVE' && !!variant.sku)
          .map((variant) => ({
            sku: variant.sku,
            name: product.name,
            unit: '',
            image: variant.image || product.images.find((item) => item.isPrimary)?.url || product.images[0]?.url || null,
            categoryId: product.categoryId,
            price: variant.finalPrice ?? variant.price,
          })));
      },
      error: () => { this.productOptions = []; },
    });
    if (this.serviceId && this.editorMode !== 'create') {
      this.repository.get(this.serviceId).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: (raw) => {
          this.hydrate(raw);
          if (this.editorMode === 'view') this.loadBranchDetailRows();
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse | AppHttpError) => {
          this.loading.set(false);
          this.missingService.set(true);
          this.errors.set([this.errorLabel(error)]);
        },
      });
    }
  }

  /** Read-only branch cards: do not collapse every branch into aggregate counts.
   * Branch names come from the BE branch scope. Individual config is displayed
   * only if BE returns it for the selected service and branch. */
  private loadBranchDetailRows(): void {
    this.branchesLoading.set(true);
    this.branchLoadError.set('');
    this.repository.listBranchesForServiceDetail().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (branches) => {
        this.branchDetailRows.set(branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          summary: 'Đang tải cấu hình...',
        })));
        this.branchesLoading.set(false);
        for (const branch of branches) {
          this.repository.list({
            search: this.serviceName,
            branchId: branch.id,
            mode: 'ALL',
            status: 'ALL',
            page: 1,
            pageSize: 100,
          }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (page) => {
              const service = page.items.find((item) => item.id === this.serviceId);
              const config = service?.branchServices.find((item) => item.branchId === branch.id);
              if (!config) {
                this.updateBranchSummary(branch.id, 'Chưa có dữ liệu cấu hình tại chi nhánh');
                return;
              }
              const status = this.source?.status !== 'ACTIVE'
                ? 'Chưa thể bật'
                : config.enabled && config.capacity > 0 ? 'Đang bật' : 'Đang tắt';
              const availability = service?.availabilityText ||
                (this.bookingMode === 'CONTACT_ONLY' ? 'Liên hệ' : 'Khả dụng do Backend tính');
              this.updateBranchSummary(
                branch.id,
                `${status} · Sức chứa ${config.capacity} · ${availability}`,
              );
            },
            error: () => this.updateBranchSummary(branch.id, 'Chưa tải được cấu hình tại chi nhánh'),
          });
        }
      },
      error: () => {
        this.branchesLoading.set(false);
        this.branchLoadError.set('Không tải được danh sách chi nhánh. Vui lòng thử lại.');
      },
    });
  }

  private updateBranchSummary(id: string, summary: string): void {
    this.branchDetailRows.update((rows) => rows.map((row) =>
      row.id === id ? { ...row, summary } : row,
    ));
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
    const pricing = resolveServicePricing(raw);
    this.pricingDataWarning = pricing.hasUnmappedPricing;
    this.weightPricing = pricing.weightPricing;
    this.priceTiers = TIER_WEIGHTS.map((t) => {
      const price = pricing.fixedTiers.get(t.key);
      return {
        ...t,
        mode: price !== undefined ? 'FIXED' as const : 'QUOTE' as const,
        price: price ?? null,
      };
    });
    if (!this.weightPricing && pricing.confirmedBasePrice !== null) {
      this.priceTiers[0].mode = 'FIXED';
      this.priceTiers[0].price = pricing.confirmedBasePrice;
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

  private errorLabel(error: HttpErrorResponse | AppHttpError): string {
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.status === 403) return 'Tài khoản không có quyền thao tác danh mục dịch vụ.';
    if (error.status === 404) return 'Không tìm thấy dịch vụ.';
    if (error.status === 409) return 'Dữ liệu đã thay đổi hoặc mã dịch vụ bị trùng. Vui lòng kiểm tra và thử lại.';
    if (error.status === 422 || error.status === 400)
      return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.';
    return 'Không thể kết nối đến máy chủ.';
  }

  get mayEdit(): boolean {
    return !this.readOnly && !this.missingService() && !this.loading() && !this.saving();
  }

  markDirty(): void {
    // A changed draft must use a new idempotency key; unchanged retries reuse the key.
    this.saveIdempotencyKey = null;
    this.dirty.set(true);
    this.notice.set('');
    if (this.errors().length) this.errors.set([]);
  }

  changeCategory(category: string): void {
    this.category = category;
    // A role must be chosen explicitly and be valid for the selected service type.
    this.executorRole = '';
    this.markDirty();
  }

  changeBookingMode(mode: ServiceBookingMode): void {
    this.bookingMode = mode;
    // CONTACT_ONLY does not require a standard duration (business rule).
    this.markDirty();
  }

  executorRoleLabel(): string {
    const labels: Record<string, string> = {
      CARE_STAFF_GROOMER: 'Nhân viên chăm sóc',
      NURSE: 'Y tá',
      VETERINARIAN: 'Bác sĩ thú y',
    };
    return labels[this.executorRole] ?? this.executorRole ?? '—';
  }

  detailPriceLabel(): string {
    const prices = this.priceTiers
      .filter((tier) => tier.mode === 'FIXED' && tier.price !== null && tier.price > 0)
      .map((tier) => tier.price as number);
    if (prices.length) return (this.weightPricing ? 'Từ ' : '') + this.formatMoney(Math.min(...prices)) + 'đ';
    if (this.source?.referencePrice !== null && this.source?.referencePrice !== undefined) {
      return this.formatMoney(this.source.referencePrice) + 'đ';
    }
    if (this.pricingDataWarning) return 'Giá chưa đồng bộ';
    return this.bookingMode === 'CONTACT_ONLY' ? 'Báo giá sau tiếp nhận' : 'Chưa cấu hình giá';
  }

  formatMoney(price: number | null): string {
    return price === null || !Number.isFinite(price) ? '' : new Intl.NumberFormat('vi-VN').format(price);
  }

  setTierPrice(tier: Tier, input: string): void {
    const digits = input.replace(/[^0-9]/g, '');
    tier.price = digits ? Number(digits) : null;
    this.markPricingDirty();
  }

  moneyWords(price: number | null): string {
    if (price === null || !Number.isSafeInteger(price) || price < 0) return '';
    if (price === 0) return 'Không đồng';
    const words = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const triple = (n: number, full: boolean): string => {
      const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, u = n % 10;
      const p: string[] = [];
      if (h || full) p.push(words[h], 'trăm');
      if (t >= 2) {
        p.push(words[t], 'mươi');
        if (u) p.push(u === 1 ? 'mốt' : u === 5 ? 'lăm' : words[u]);
      } else if (t === 1) {
        p.push('mười');
        if (u) p.push(u === 5 ? 'lăm' : words[u]);
      } else if (u) {
        if (h || full) p.push('lẻ');
        p.push(words[u]);
      }
      return p.join(' ');
    };
    const scales = ['', 'nghìn', 'triệu', 'tỷ'];
    const chunks: number[] = [];
    let rest = price;
    while (rest > 0) { chunks.push(rest % 1000); rest = Math.floor(rest / 1000); }
    if (chunks.length > scales.length) return '';
    const out: string[] = [];
    for (let i = chunks.length - 1; i >= 0; i--) {
      if (!chunks[i]) continue;
      out.push(triple(chunks[i], i < chunks.length - 1 && chunks[i] < 100));
      if (scales[i]) out.push(scales[i]);
    }
    const result = out.join(' ') + ' đồng';
    return result.charAt(0).toUpperCase() + result.slice(1);
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

  markMaterialDirty(): void {
    this.materialsDirty = true;
    this.markDirty();
  }

  addMaterial(): void {
    this.materialsDirty = true;
    this.materials.push({
      key: this.nextMaterialKey++, sku: '', query: '', quantity: null, unit: '',
    });
    this.markDirty();
  }

  removeMaterial(key: number): void {
    this.materialsDirty = true;
    this.materials = this.materials.filter((line) => line.key !== key);
    if (this.openMaterialKey() === key) this.openMaterialKey.set(null);
    this.markDirty();
  }

  matchProduct(line: MaterialLine, text: string): void {
    this.materialsDirty = true;
    line.query = text;
    const normalized = text.trim().toLocaleLowerCase('vi');
    const product = this.productOptions.find((item) =>
      item.name.toLocaleLowerCase('vi') === normalized || item.sku.toLocaleLowerCase('vi') === normalized);
    line.sku = product?.sku ?? '';
    if (product && !line.unit) line.unit = product.unit;
    this.markDirty();
  }

  filteredMaterialOptions(line: MaterialLine): MaterialOption[] {
    const term = line.query.trim().toLocaleLowerCase('vi');
    return this.productOptions.filter((item) =>
      !term || item.name.toLocaleLowerCase('vi').includes(term) || item.sku.toLocaleLowerCase('vi').includes(term)
    ).slice(0, 20);
  }

  productCategoryLabel(id: string): string {
    return this.productCategoryNames.get(id) || 'Chưa có danh mục';
  }

  chooseMaterial(line: MaterialLine, item: MaterialOption): void {
    line.query = item.name;
    line.sku = item.sku;
    if (!line.unit) line.unit = item.unit;
    this.openMaterialKey.set(null);
    this.markMaterialDirty();
  }

  closeMaterialMenu(key: number): void {
    if (this.openMaterialKey() === key) this.openMaterialKey.set(null);
  }

  toggleStatus(): void {
    this.active = !this.active;
    this.markDirty();
  }

  private validate(): string[] {
    const messages: string[] = [];
    if (this.pricingDirty && this.pricingDataWarning) {
      messages.push('Dữ liệu giá cũ chưa đồng bộ với các mức giá trên màn hình. Vui lòng xác nhận hợp đồng giá với Backend trước khi lưu thay đổi giá để tránh ghi đè.');
    }
    if (this.serviceName.trim().length < 2 || this.serviceName.trim().length > 120) {
      messages.push('Tên dịch vụ phải có từ 2 đến 120 ký tự.');
    }
    if (!['GROOMING', 'MEDICAL'].includes(this.category)) messages.push('Vui lòng chọn loại dịch vụ.');
    if (!['BOOKABLE', 'REQUEST_ONLY', 'CONTACT_ONLY'].includes(this.bookingMode)) {
      messages.push('Vui lòng chọn hình thức đặt lịch.');
    }
    if ((this.category === 'GROOMING' && this.executorRole !== 'CARE_STAFF_GROOMER') ||
      (this.category === 'MEDICAL' && !['VETERINARIAN', 'NURSE'].includes(this.executorRole))) {
      messages.push('Vai trò thực hiện không hợp lệ.');
    }
    if (this.bookingMode !== 'CONTACT_ONLY' &&
      (!Number.isSafeInteger(this.durationMinutes) || (this.durationMinutes ?? 0) <= 0)) {
      messages.push('Thời lượng phải là số nguyên dương đối với dịch vụ đặt lịch hoặc yêu cầu.');
    }
    if (this.bookingMode === 'CONTACT_ONLY' && this.durationMinutes !== null &&
      (!Number.isSafeInteger(this.durationMinutes) || this.durationMinutes <= 0)) {
      messages.push('Thời lượng nếu nhập phải là số nguyên dương.');
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
    if (this.materialsDirty) {
      this.errors.set(['Chưa thể lưu thay đổi vật liệu. Vui lòng bỏ các thay đổi vật liệu và thử lại.']);
      return;
    }
    const prices = this.pricePayload();
    const body: ServiceWrite = {
      name: this.serviceName.trim(),
      serviceType: this.category as 'GROOMING' | 'MEDICAL',
      // BE category is an independent optional taxonomy field; don't overwrite it with serviceType.
      description: this.description.trim(),
      bookingMode: this.bookingMode as ServiceBookingMode,
      requiredStaffRole: this.executorRole as ServiceWrite['requiredStaffRole'],
      durationMinutes: this.bookingMode === 'CONTACT_ONLY' ? this.durationMinutes : this.durationMinutes!,
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
        this.back();
      },
      error: (error: HttpErrorResponse | AppHttpError) => {
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
