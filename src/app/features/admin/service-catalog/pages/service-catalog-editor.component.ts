import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
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
import { catchError, firstValueFrom, forkJoin, from, map, mergeMap, of, switchMap, toArray } from 'rxjs';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { CatalogService, ServiceApiRecord, ServiceBookingMode, ServicePriceVariant, ServiceWrite } from '../models/service-catalog.model';
import { ServiceCatalogApiService, serviceFromApi } from '../services/service-catalog-api.service';
import { resolveServicePricing } from '../services/service-pricing.utils';
import { AdminInventoryService } from '../../inventory/services/admin-inventory.service';
import { AdminCategoryService } from '../../categories/services/admin-category.service';
import { BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
import { DraftBranchSelection, ServiceBranchConfigFlowComponent } from '../components/service-branch-config-flow.component';

type PriceMode = 'FIXED' | 'QUOTE';
type Tier = { key: string; weight: string; mode: PriceMode; price: number | null };
type MaterialOption = { materialId: string; sku: string; name: string; unit: string; image: string | null; categoryId: string; price: number };
type MaterialLine = { key: number; materialId: string; sku: string; query: string; quantity: number | null; unit: string };
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
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent, AdminDataStateComponent, ServiceBranchConfigFlowComponent],
  templateUrl: './service-catalog-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCatalogEditorComponent {
  private readonly repository = inject(ServiceCatalogApiService);
  private readonly branchesApi = inject(BranchManagementApiService);
  private readonly inventoryApi = inject(AdminInventoryService);
  private readonly categoryApi = inject(AdminCategoryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly previewToast = effect(() => {
    const message = this.notice();
    if (message) this.toast.show(message, /thành công/i.test(message) ? 'success' : 'info');
  });
  private readonly branchErrorToast = effect(() => {
    const message = this.branchLoadError();
    if (message) this.toast.show(message, 'error');
  });
  private readonly activationToast = effect(() => {
    const message = this.activationNotice();
    if (message) this.toast.show(message, 'info');
  });
  private readonly errorToast = effect(() => {
    const message = this.errors()[0];
    if (message) this.toast.show(message, 'error');
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
  readonly stagedBranchConfigs = signal<readonly DraftBranchSelection[]>([]);
  readonly branchConfigFlowOpen = signal(false);
  readonly branchConfigTargetId = signal<string | null>(null);
  get displayedBranchRows(): readonly BranchDetailRow[] {
    if (!this.isNew) return this.branchDetailRows();
    return this.stagedBranchConfigs().map((item) => ({
      id: item.branchId,
      name: item.branchName,
      summary: (item.enabled ? 'Đang bật' : 'Đang tắt') + ' · Sức chứa ' + item.capacity +
        (item.enabled ? ' · Khả dụng theo lịch' : ' · Tắt tại chi nhánh'),
    }));
  }
  get branchConfigService(): CatalogService {
    if (this.source) return this.source;
    return {
      id: '__unsaved_service__',
      serviceCode: '',
      name: this.serviceName.trim() || 'Dịch vụ mới',
      category: this.category || 'GROOMING',
      executorRole: this.executorRole || 'CARE_STAFF_GROOMER',
      bookingMode: this.bookingMode || 'BOOKABLE',
      durationMinutes: this.durationMinutes,
      status: this.active ? 'ACTIVE' : 'INACTIVE',
      referencePrice: null,
      minFixedTierPrice: null,
      branchServices: [],
    };
  }
  openBranchConfiguration(branchId: string | null = null): void {
    if (this.isNew && !this.active) {
      this.toast.show('Vui lòng bật trạng thái dịch vụ trước khi chọn chi nhánh.', 'info');
      return;
    }
    this.branchConfigTargetId.set(branchId);
    this.branchConfigFlowOpen.set(true);
  }
  closeBranchConfiguration(): void {
    this.branchConfigFlowOpen.set(false);
    this.branchConfigTargetId.set(null);
  }
  stageBranchConfig(selection: DraftBranchSelection): void {
    this.stagedBranchConfigs.update((items) => [
      ...items.filter((item) => item.branchId !== selection.branchId), selection,
    ]);
    this.markDirty();
    this.closeBranchConfiguration();
  }
  refreshBranchConfigs(): void {
    this.loadBranchDetailRows();
    this.closeBranchConfiguration();
  }
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
  @ViewChild('materialSearchInput') private materialSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('materialPickerDialog') private materialPickerDialog?: ElementRef<HTMLElement>;
  @ViewChild('materialAddTrigger') private materialAddTrigger?: ElementRef<HTMLButtonElement>;
  readonly materialPickerOpen = signal(false);
  readonly materialPickerSearch = signal('');
  readonly materialPickerPending = signal<string[]>([]);
  readonly materialPickerVisible = signal(20);
  readonly materialCatalogLoading = signal(true);
  readonly materialCatalogError = signal('');
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
  readonly pendingActivationServiceId = signal<string | null>(null);
  readonly activationNotice = signal('');

  constructor() {
    this.categoryApi.listCategories({ limit: 100 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        for (const category of page.items) this.productCategoryNames.set(category.id, category.name);
      },
    });
    this.loadMaterialCatalog();
    if (this.serviceId && this.editorMode !== 'create') {
      this.repository.get(this.serviceId).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: (raw) => {
          this.hydrate(raw);
          this.loadBranchDetailRows();
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

  loadMaterialCatalog(): void {
    this.materialCatalogLoading.set(true);
    this.materialCatalogError.set('');
    forkJoin({
      items: this.inventoryApi.listItems(),
      products: this.inventoryApi.listCatalogProducts(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({items, products}) => {
        const productBySku = new Map(products.flatMap(product => product.variants.map(variant => [
          variant.sku,
          {
            image: variant.image || product.images.find(image => image.isPrimary)?.url || product.images[0]?.url || null,
            categoryId: product.categoryId,
            price: variant.finalPrice ?? variant.price,
          },
        ] as const)));
        this.productOptions = items.filter(item => item.status === 'ACTIVE').map(item => {
          const product = productBySku.get(item.sku);
          return {
            materialId: item.id, sku: item.sku, name: item.name,
            unit: item.unit || '', image: product?.image ?? null,
            categoryId: product?.categoryId ?? '', price: product?.price ?? 0,
          };
        });
        this.refreshMaterialLabels();
        this.materialCatalogLoading.set(false);
      },
      error: () => {
        this.productOptions = [];
        this.materialCatalogLoading.set(false);
        this.materialCatalogError.set('Không tải được danh sách vật liệu. Vui lòng thử lại.');
      },
    });
  }

  /** Read-only branch cards: do not collapse every branch into aggregate counts.
   * Branch names come from the BE branch scope. Individual config is displayed
   * only if BE returns it for the selected service and branch. */
  private loadBranchDetailRows(): void {
    if (!this.serviceId) return;
    this.branchesLoading.set(true);
    this.branchLoadError.set('');
    this.repository.getBranchConfigs(this.serviceId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (configs) => {
        const role = this.authSessionRole;
        const scope = new Set(this.authSession.user()?.branchScope ?? []);
        const visible = role === 'ADMIN'
          ? configs
          : configs.filter((config) => scope.has(config.branchId));
        this.branchDetailRows.set(visible.map((config) => {
          const status = this.source?.status !== 'ACTIVE'
            ? 'Chưa thể bật'
            : config.branchStatus === 'INACTIVE'
              ? 'Chi nhánh ngừng hoạt động'
              : config.enabled && config.capacity > 0 ? 'Đang bật' : 'Đang tắt';
          const availability = this.bookingMode === 'CONTACT_ONLY'
            ? 'Liên hệ'
            : 'Khả dụng theo lịch';
          return {
            id: config.branchId,
            name: config.branchName,
            summary: `${status} · Sức chứa ${config.capacity} · ${availability}`,
          };
        }));
        this.branchesLoading.set(false);
      },
      error: () => {
        this.branchesLoading.set(false);
        this.branchLoadError.set('Không tải được cấu hình chi nhánh. Vui lòng thử lại.');
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
    this.materials = (raw.defaultMaterials ?? []).map((m) => ({
      key: this.nextMaterialKey++,
      materialId: m.materialId,
      sku: '',
      query: m.materialId,
      quantity: m.defaultQuantity,
      unit: m.unit,
    }));
    this.refreshMaterialLabels();
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

  openMaterialPicker(): void {
    if (this.readOnly || this.saving()) return;
    this.materialPickerPending.set([]);
    this.materialPickerSearch.set('');
    this.materialPickerVisible.set(20);
    this.materialPickerOpen.set(true);
    setTimeout(() => this.materialSearchInput?.nativeElement.focus(), 0);
  }
  closeMaterialPicker(): void {
    this.materialPickerOpen.set(false);
    this.materialPickerPending.set([]);
    setTimeout(() => this.materialAddTrigger?.nativeElement.focus(), 0);
  }
  setMaterialPickerSearch(value: string): void {
    this.materialPickerSearch.set(value);
    this.materialPickerVisible.set(20);
  }
  materialPickerMatches(): MaterialOption[] {
    const term = this.materialPickerSearch().trim().toLocaleLowerCase('vi');
    return this.productOptions.filter(item =>
      !term || item.name.toLocaleLowerCase('vi').includes(term) ||
      item.sku.toLocaleLowerCase('vi').includes(term));
  }
  materialAlreadyAdded(id: string): boolean {
    return this.materials.some(line => line.materialId === id);
  }
  toggleMaterialPending(id: string, checked: boolean): void {
    if (this.materialAlreadyAdded(id)) return;
    this.materialPickerPending.update(current =>
      checked ? (current.includes(id) ? current : [...current, id]) : current.filter(x => x !== id));
  }
  applyMaterials(): void {
    if (this.readOnly || this.saving()) return;
    const pending = new Set(this.materialPickerPending());
    const picked = this.productOptions.filter(item =>
      pending.has(item.materialId) && !this.materialAlreadyAdded(item.materialId));
    for (const item of picked) {
      this.materials.push({
        key: this.nextMaterialKey++, materialId: item.materialId, sku: item.sku,
        query: item.name, quantity: null, unit: item.unit,
      });
    }
    if (picked.length) this.markMaterialDirty();
    this.closeMaterialPicker();
  }
  removeMaterial(key: number): void {
    this.materials = this.materials.filter(line => line.key !== key);
    this.markMaterialDirty();
  }
  @HostListener('document:keydown', ['$event'])
  onMaterialPickerKey(event: KeyboardEvent): void {
    if (!this.materialPickerOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMaterialPicker();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = this.materialPickerDialog?.nativeElement;
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href]')].filter(el => el.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault(); first.focus();
    }
  }

  private refreshMaterialLabels(): void {
    if (!this.productOptions.length || !this.materials.length) return;
    for (const line of this.materials) {
      const option = this.productOptions.find(item =>
        item.materialId === line.materialId || (!!line.sku && item.sku === line.sku));
      if (!option) continue;
      line.materialId = option.materialId;
      line.sku = option.sku;
      line.query = option.name;
      if (!line.unit) line.unit = option.unit;
    }
  }

  productCategoryLabel(id: string): string {
    return this.productCategoryNames.get(id) || 'Chưa có danh mục';
  }

  toggleStatus(): void {
    this.active = !this.active;
    this.markDirty();
  }

  private validate(): string[] {
    const messages: string[] = [];
    if (this.pricingDirty && this.pricingDataWarning) {
      messages.push('Giá hiện tại chưa khớp với các mức giá. Vui lòng liên hệ quản trị viên trước khi thay đổi.');
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
      messages.push('Vui lòng chọn vai trò phù hợp với loại dịch vụ.');
    }
    if (this.bookingMode !== 'CONTACT_ONLY' &&
      (!Number.isSafeInteger(this.durationMinutes) || (this.durationMinutes ?? 0) <= 0)) {
      messages.push('Vui lòng nhập thời lượng lớn hơn 0 phút, không dùng số thập phân.');
    }
    if (this.bookingMode === 'CONTACT_ONLY' && this.durationMinutes !== null &&
      (!Number.isSafeInteger(this.durationMinutes) || this.durationMinutes <= 0)) {
      messages.push('Thời lượng phải lớn hơn 0 phút, không dùng số thập phân.');
    }
    if (/phẫu thuật|triệt sản|mổ/i.test(this.serviceName) && this.bookingMode !== 'REQUEST_ONLY') {
      messages.push('Dịch vụ phẫu thuật cần chọn hình thức “Yêu cầu đặt lịch”.');
    }
    if (/cấp cứu/i.test(this.serviceName) && this.bookingMode !== 'CONTACT_ONLY') {
      messages.push('Dịch vụ cấp cứu cần chọn hình thức “Liên hệ trực tiếp”.');
    }

    for (const material of this.materials) {
      if (!material.materialId) messages.push('Vui lòng chọn vật liệu hợp lệ từ danh sách.');
      if (!material.quantity || !Number.isFinite(material.quantity) || material.quantity <= 0) {
        messages.push('Số lượng vật liệu mặc định phải lớn hơn 0.');
      }
    }

    if (this.weightPricing) {
      for (const tier of this.priceTiers) {
        if (tier.mode === 'FIXED' && (tier.price === null ||
          !Number.isSafeInteger(tier.price) || tier.price <= 0)) {
          messages.push('Giá mức ' + tier.key + ' phải lớn hơn 0 đồng và không có phần thập phân.');
        }
      }
    } else if (this.priceTiers[0].mode === 'FIXED' &&
      (this.priceTiers[0].price === null || !Number.isSafeInteger(this.priceTiers[0].price) ||
      this.priceTiers[0].price <= 0)) {
      messages.push('Vui lòng nhập giá lớn hơn 0 đồng hoặc chọn “Liên hệ báo giá”.');
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
    if (this.pendingActivationServiceId()) {
      void this.enableUnconfiguredBranches(this.pendingActivationServiceId()!);
      return;
    }
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
      // BE category is an independent optional taxonomy field; don't overwrite it with serviceType.
      description: this.description.trim(),
      bookingMode: this.bookingMode as ServiceBookingMode,
      requiredStaffRole: this.executorRole as ServiceWrite['requiredStaffRole'],
      durationMinutes: this.bookingMode === 'CONTACT_ONLY' ? this.durationMinutes : this.durationMinutes!,
      status: this.active ? 'ACTIVE' : 'INACTIVE',
      defaultMaterials: this.materials.map(material => ({
        materialId: material.materialId,
        defaultQuantity: material.quantity ?? 1,
        unit: material.unit.trim(),
      })),
      ...(this.isNew ? {
        autoEnableActiveBranches: this.active,
        branchConfigs: this.stagedBranchConfigs().map((item) => ({
          branchId: item.branchId,
          enabled: item.enabled && this.active,
          capacity: item.capacity,
          availability: [],
        })),
      } : {}),
      ...prices,
    };
    this.saving.set(true);
    const updateBody = this.pricingDirty
      ? body
      : (({ basePrice: _price, priceVariants: _variants, autoEnableActiveBranches: _auto, branchConfigs: _branches, ...rest }) => rest)(body);
    const shouldArchive = !this.isNew && this.source?.status === 'ACTIVE' && !this.active;
    const request = this.isNew
      ? this.repository.create(body, this.saveIdempotencyKey ??= crypto.randomUUID())
      : this.repository.update(this.serviceId!, updateBody).pipe(
          switchMap((saved) => shouldArchive
            ? this.repository.archive(saved.id, crypto.randomUUID())
            : of(saved)),
        );
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.dirty.set(false);
        if (!this.isNew && this.active && saved.id) {
          // Existing services may predate automatic branch provisioning.
          // Reconcile only missing configs; creation is already atomic in BE.
          this.pendingActivationServiceId.set(saved.id);
          void this.enableUnconfiguredBranches(saved.id);
          return;
        }
        this.saving.set(false);
        this.notice.set(this.isNew ? 'Đã thêm dịch vụ thành công.' : 'Đã cập nhật dịch vụ thành công.');
        this.back();
      },
      error: (error: HttpErrorResponse | AppHttpError) => {
        this.saving.set(false);
        this.errors.set([this.errorLabel(error)]);
      },
    });
  }

  /**
   * Existing services created before atomic branch provisioning may be missing
   * BranchServiceConfig rows. Reconcile missing configs only for those records.
   * New services send branchConfigs/autoEnableActiveBranches in the create payload.
   */
  async enableUnconfiguredBranches(serviceId: string): Promise<void> {
    if (!serviceId) return;
    this.saving.set(true);
    this.activationNotice.set('');
    this.errors.set([]);
    try {
      const branches = (await firstValueFrom(this.branchesApi.listBranches()))
        .filter((branch) => branch.status === 'ACTIVE' ||
          this.stagedBranchConfigs().some((draft) => draft.branchId === branch.id));
      const results = await firstValueFrom(from(branches).pipe(
        mergeMap((branch) => this.branchesApi.listServiceConfigs(branch.id).pipe(
          mergeMap((configs) => {
            const existing = configs.find((row) => row.serviceId === serviceId);
            const draft = this.stagedBranchConfigs().find((item) => item.branchId === branch.id);
            // After creation, the chosen settings override server-side defaults.
            // For older services, an explicit existing config is never overwritten.
            if (existing && (!this.isNew || !draft)) {
              return of({ failed: false, unchanged: true });
            }
            const enabled = draft
              ? draft.enabled && this.active && branch.status === 'ACTIVE'
              : this.active;
            const capacity = draft?.capacity ?? 1;
            if (existing && existing.enabled === enabled && existing.capacity === capacity) {
              return of({ failed: false, unchanged: true });
            }
            return this.branchesApi.updateServiceConfig(branch.id, serviceId, {
              enabled, capacity, availability: existing?.availability ?? [],
            }).pipe(map(() => ({ failed: false, unchanged: false })));
          }),
          catchError(() => of({ failed: true, unchanged: false })),
        ), 4),
        toArray(),
      ));
      const failures = results.filter((result) => result.failed).length;
      if (failures) {
        this.pendingActivationServiceId.set(serviceId);
        this.activationNotice.set(
          'Dịch vụ đã được lưu, nhưng chưa thể bật tại ' + failures +
          ' chi nhánh. Vui lòng chọn “Thử lại” để hoàn tất.',
        );
        return;
      }
      this.pendingActivationServiceId.set(null);
      this.dirty.set(false);
      if (this.editorMode === 'view') {
        this.loadBranchDetailRows();
        this.toast.show('Đã cập nhật các chi nhánh chưa cấu hình.', 'success');
        return;
      }
      this.notice.set(this.isNew
        ? 'Thêm dịch vụ thành công. Đã bật tại các chi nhánh đang hoạt động.'
        : 'Cập nhật dịch vụ thành công.');
      this.back();
    } catch {
      this.pendingActivationServiceId.set(serviceId);
      this.activationNotice.set(
        'Dịch vụ đã được lưu, nhưng chưa thể cập nhật các chi nhánh. Vui lòng thử lại.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  applyDefaultAtMissingBranches(): void {
    if (this.authSessionRole !== 'ADMIN' || !this.serviceId || !this.active || this.saving()) return;
    void this.enableUnconfiguredBranches(this.serviceId);
  }

  retryBranchActivation(): void {
    const serviceId = this.pendingActivationServiceId();
    if (!serviceId || this.saving()) return;
    void this.enableUnconfiguredBranches(serviceId);
  }

  cancel(): void {
    if (this.dirty() && this.mayEdit) {
      this.showCancelConfirmation.set(true);
    } else {
      this.back();
    }
  }

  confirmCancel(): void {
    this.showCancelConfirmation.set(false);
    this.back();
  }
}
