import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AdminProductService } from '../../products/services/admin-product.service';
import { AdminInventoryService } from '../../inventory/services/admin-inventory.service';
import { AdminProduct, ProductVariant } from '../../products/models/admin-product.model';
import {
  AdminFlashSale, AdminFlashSaleApiService, FlashSaleActivationMode, FlashSaleItemWrite, FlashSaleWriteBody,
  flashSaleState, flashSaleDate, flashSaleMoney, FLASH_SALE_STATE_LABELS,
} from '../services/admin-flash-sale-api.service';

interface DraftProduct {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  imageUrl: string;
  originalPrice: number;
  salePrice: string;
  /** Editable percentage; the final price is always derived from the SKU price. */
  discountPercent: string;
  quantityLimit: string;
  soldQuantity: number;
  totalStock: number | null;
}
interface SaleForm {
  name: string;
  description: string;
  from: string;
  to: string;
  items: DraftProduct[];
}
interface ProductOption {
  key: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  imageUrl: string;
  sku: string;
  price: number;
  totalStock: number | null;
}

const EMPTY_FORM: SaleForm = {name:'', description:'', from:'', to:'', items:[]};

/** Input datetime-local intentionally represents Asia/Ho_Chi_Minh, not client device timezone. */
function vietnamLocal(iso: string): string {
  const millis = Date.parse(iso);
  if (!Number.isFinite(millis)) return '';
  return new Date(millis + 7 * 60 * 60000).toISOString().slice(0, 16);
}
function utcFromVietnam(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value + ':00+07:00');
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

@Component({
  selector: 'app-admin-flash-sale-editor',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent, AdminBreadcrumbComponent, AdminDataStateComponent],
  templateUrl: './admin-flash-sale-editor.component.html',
  styleUrl: './admin-flash-sale-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFlashSaleEditorComponent {
  @ViewChild('pickerDialog') private pickerDialog?: ElementRef<HTMLElement>;
  @ViewChild('leaveDialog') private leaveDialog?: ElementRef<HTMLElement>;
  @ViewChild('keepEditing') private keepEditingButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('productSearch') private productSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('addProductTrigger') private addProductTrigger?: ElementRef<HTMLButtonElement>;

  private readonly api = inject(AdminFlashSaleApiService);
  private readonly productsApi = inject(AdminProductService);
  private readonly inventoryApi = inject(AdminInventoryService);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = this.route.snapshot.data['mode'] as 'create' | 'edit' | 'view';
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly original = signal<AdminFlashSale | null>(null);
  readonly form = signal<SaleForm>({...EMPTY_FORM, items:[]});
  readonly loading = signal(this.mode !== 'create');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly validation = signal('');
  /** Quick-apply controls; per-item overrides remain available. */
  readonly bulkDiscount = signal('');
  readonly selectedSkus = signal<string[]>([]);
  readonly selectedCount = computed(() => this.form().items.filter(item => this.selectedSkus().includes(item.sku)).length);
  readonly allRowsSelected = computed(() => this.form().items.length > 0 && this.selectedCount() === this.form().items.length);
  readonly dirty = signal(false);
  readonly canManage = computed(() => this.session.user()?.systemRole === 'ADMIN');
  readonly editable = computed(() => this.mode !== 'view' && this.canManage() && !this.saving() &&
    (!this.original() || flashSaleState(this.original()!, this.now()) !== 'ENDED'));
  readonly currentState = computed(() => this.original() ? flashSaleState(this.original()!, this.now()) : 'DRAFT');
  readonly stateLabels = FLASH_SALE_STATE_LABELS;
  readonly now = signal(Date.now());
  // Current Vietnam-local minute, rounded up so a newly selected start never lies in the past.
  readonly minimumStartAt = computed(() =>
    vietnamLocal(new Date(Math.ceil(this.now() / 60000) * 60000).toISOString()));
  readonly draftEnabled = signal(true);
  readonly startTimeLocked = computed(() => {
    const sale = this.original();
    return this.mode === 'edit' && sale?.status === 'PUBLISHED' &&
      Date.parse(sale.startAt) < this.now();
  });
  readonly operatingEnabled = computed(() =>
    this.original()?.status === 'PUBLISHED'
      ? !this.original()!.isPaused : this.draftEnabled());
  readonly selectedStart = computed(() => {
    const sale = this.original();
    return sale?.status === 'PUBLISHED'
      ? Date.parse(sale.startAt)
      : Date.parse(utcFromVietnam(this.form().from) ?? '');
  });
  readonly selectedEnd = computed(() => {
    const sale = this.original();
    return sale?.status === 'PUBLISHED'
      ? Date.parse(sale.endAt)
      : Date.parse(utcFromVietnam(this.form().to) ?? '');
  });
  // Even before dates are selected, the default is automatic scheduled activation.
  readonly endTimePassed = computed(() => Number.isFinite(this.selectedEnd()) && this.selectedEnd() <= this.now());
  readonly isPreStart = computed(() =>
    !Number.isFinite(this.selectedStart()) || this.selectedStart() > this.now());
  readonly operatingLabel = computed(() => this.isPreStart()
    ? this.operatingEnabled() ? 'Tự động kích hoạt theo lịch' : 'Kích hoạt thủ công'
    : this.operatingEnabled() ? 'Đang hoạt động' : 'Tạm ngừng');
  private modeFor(sale: AdminFlashSale | null, enabled: boolean): FlashSaleActivationMode {
    return sale?.activationMode ??
      (sale?.status === 'PUBLISHED' ? (sale.isPaused ? 'MANUAL' : 'AUTO') : (enabled ? 'AUTO' : 'MANUAL'));
  }

  readonly pickerOpen = signal(false);
  readonly pickerLoading = signal(false);
  readonly pickerError = signal('');
  readonly pickerSearch = signal('');
  readonly pickerOptions = signal<ProductOption[]>([]);
  // Sum actual stock records over all branches, joined by InventoryItem SKU.
  // Unavailable stock must not be reported as zero.
  readonly stockBySku = signal<Record<string, number>>({});
  stockFor(product: DraftProduct): number | null {
    const stock = this.stockBySku()[product.sku];
    return Number.isFinite(stock) ? stock : product.totalStock;
  }
  private loadStockTotals(): void {
    forkJoin({
      items: this.inventoryApi.listItems(),
      stocks: this.inventoryApi.listStocks(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({items, stocks}) => {
        const skuById = new Map(items.filter(item => item.kind === 'PRODUCT')
          .map(item => [item.id, item.sku] as const));
        const counts: Record<string, number> = {};
        for (const row of stocks) {
          const sku = skuById.get(row.inventoryItemId);
          if (!sku || !Number.isFinite(row.quantity)) continue;
          counts[sku] = (counts[sku] ?? 0) + row.quantity;
        }
        this.stockBySku.set(counts);
      },
      error: () => this.stockBySku.set({}),
    });
  }
  readonly pickerSelected = signal<ProductOption[]>([]);
  readonly pickerNextCursor = signal<string | null>(null);
  readonly leaveOpen = signal(false);
  private leaveResolver: ((decision: boolean) => void) | null = null;
  private allowSavedNavigation = false;
  private pickerRequest = 0;
  private pickerSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private nowInterval: ReturnType<typeof setInterval> | null = null;
  private focusTimeout: ReturnType<typeof setTimeout> | null = null;
  private createKey = this.newCreateKey();

  private newCreateKey(): string {
    return 'flash-create-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  private resetCreateKeyWhenDraftChanges(): void {
    if (this.mode === 'create') this.createKey = this.newCreateKey();
  }

  constructor() {
    this.nowInterval = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => {
      if (this.nowInterval) clearInterval(this.nowInterval);
      if (this.pickerSearchTimer) clearTimeout(this.pickerSearchTimer);
      if (this.focusTimeout) clearTimeout(this.focusTimeout);
      this.leaveResolver?.(false);
      this.leaveResolver = null;
    });
    this.loadStockTotals();
    if (this.mode !== 'create') this.load();
  }

  private message(err: unknown, fallback: string): string {
    const status = err instanceof HttpErrorResponse ? err.status
      : (typeof err === 'object' && err && 'status' in err ? Number(err.status) : 0);
    if (status === 404) return this.mode === 'create' ? 'Chức năng tạo Flash Sale chưa được BE hỗ trợ.' : 'Không tìm thấy chương trình Flash Sale.';
    if ([405,501].includes(status)) return 'BE chưa hỗ trợ chức năng quản lý Flash Sale trên môi trường này.';
    return adminErrorMessage(err, fallback);
  }

  load(): void {
    if (!this.id) return;
    this.loading.set(true);this.error.set('');
    this.api.get(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sale => {
        if (this.mode === 'edit' && flashSaleState(sale) === 'ENDED') {
          this.loading.set(false);
          this.toast.show('Chương trình đã kết thúc, chỉ có thể xem thông tin.','info');
          void this.router.navigate(['/admin/flash-sales',sale.id]);
          return;
        }
        this.original.set(sale);
        this.draftEnabled.set(sale.activationMode === 'MANUAL' ? false : !sale.isPaused);
        this.form.set({
          name:sale.name, description:sale.description,
          from:vietnamLocal(sale.startAt),to:vietnamLocal(sale.endAt),
          items:sale.items.map(x=>({
            productId:x.productId,variantId:x.variantId,sku:x.sku,
            productName:x.productName,variantName:x.variantName,
            imageUrl:x.imageUrl??'',originalPrice:x.originalPrice,
            salePrice:String(x.salePrice),discountPercent:this.percentageFor(x.originalPrice,x.salePrice),
            quantityLimit:String(x.quantityLimit),
            soldQuantity:x.soldQuantity,
            totalStock:typeof x.totalStock === 'number' ? x.totalStock : null,
          })),
        });
        this.bulkDiscount.set('');
        this.selectedSkus.set([]);
        this.dirty.set(false);this.loading.set(false);
        void this.enrichMissingNames();
      },
      error: err=>{this.loading.set(false);this.error.set(this.message(err,'Không tải được Flash Sale.'));},
    });
  }
  /**
   * Legacy seed campaigns sometimes omit productName. Resolve display labels from
   * the authoritative catalog, without replacing saved Flash Sale prices.
   */
  private async enrichMissingNames(): Promise<void> {
    const missing = [...new Set(this.form().items
      .filter(item => (!item.productName || item.productName === 'Sản phẩm chưa có tên') && item.productId)
      .map(item => item.productId))];
    if (!missing.length) return;
    const responses = await Promise.all(missing.map(async id => {
      try { return {id, product: await firstValueFrom(this.productsApi.getProduct(id))}; }
      catch { return {id, product: null}; }
    }));
    if (this.destroyRef.destroyed) return;
    const products = new Map(responses.filter(result => result.product)
      .map(result => [result.id, result.product!] as const));
    this.form.update(form => ({...form,items:form.items.map(item => {
      const product = products.get(item.productId);
      if (!product) return item;
      const variant = product.variants.find(v => v.id === item.variantId || v.sku === item.sku);
      const imageUrl = item.imageUrl || variant?.image ||
        product.images?.find(img => img.isPrimary)?.url || product.images?.[0]?.url || '';
      return {
        ...item,
        productName: item.productName === 'Sản phẩm chưa có tên' ? product.name : item.productName,
        variantName: item.variantName === 'Mặc định' ? (variant?.label || item.variantName) : item.variantName,
        imageUrl,
      };
    })}));
  }
  totalSold(): number {
    return this.form().items.reduce((sum, item) => sum + (Number.isFinite(item.soldQuantity) ? item.soldQuantity : 0), 0);
  }
  totalQuota(): number {
    return this.form().items.reduce((sum, item) =>
      sum + (Number.isFinite(Number(item.quantityLimit)) ? Number(item.quantityLimit) : 0), 0);
  }
  soldPercent(item: DraftProduct): number {
    const quota = Number(item.quantityLimit);
    return quota > 0 ? Math.max(0, Math.min(100, item.soldQuantity / quota * 100)) : 0;
  }
  isSelected(sku: string): boolean { return this.selectedSkus().includes(sku); }
  toggleSelected(sku: string, checked: boolean): void {
    if (!this.editable()) return;
    this.selectedSkus.update(items => checked
      ? (items.includes(sku) ? items : [...items,sku])
      : items.filter(id => id !== sku));
  }
  toggleSelectAll(checked: boolean): void {
    if (!this.editable()) return;
    this.selectedSkus.set(checked ? this.form().items.map(item => item.sku) : []);
  }

  changeStart(input: HTMLInputElement): void {
    if (!this.editable() || this.startTimeLocked()) return;
    const min = this.minimumStartAt();
    if (input.value && input.value < min) {
      input.value = min;
      this.update('from', min);
      this.validation.set('Thời gian bắt đầu không được trước thời điểm hiện tại.');
      return;
    }
    this.update('from', input.value);
  }
  setOperatingEnabled(enabled: boolean, input: HTMLInputElement): void {
    if (!this.editable() && this.original()?.status !== 'PUBLISHED') {
      input.checked = this.operatingEnabled();
      return;
    }
    if (this.original()?.status === 'PUBLISHED') {
      void this.togglePaused(!enabled, input);
      return;
    }
    this.draftEnabled.set(enabled);
    this.resetCreateKeyWhenDraftChanges();
    this.dirty.set(true);
    this.validation.set('');
  }
  selectNumericInput(event: FocusEvent): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) input.select();
  }
  update<K extends keyof Omit<SaleForm, 'items'>>(field: K, value: SaleForm[K]): void {
    if (!this.editable()) return;
    this.form.update(current=>({...current,[field]:value}));
    this.resetCreateKeyWhenDraftChanges();
    this.validation.set('');this.dirty.set(true);
  }
  /** Percent is applied to the SKU's current server-returned price. */
  discountedPrice(originalPrice: number, percent: number): number {
    return Math.round(originalPrice * (100 - percent) / 100);
  }
  percentageFor(originalPrice: number, salePrice: number): string {
    if (!Number.isFinite(originalPrice) || originalPrice <= 0 || !Number.isFinite(salePrice)) return '';
    return String(Math.round((1 - salePrice / originalPrice) * 10000) / 100);
  }
  discountInvalid(value: string): boolean {
    if (!value.trim()) return false;
    const percent = Number(value);
    return !Number.isFinite(percent) || percent <= 0 || percent >= 100;
  }
  quantityInvalid(value: string): boolean {
    if (!value.trim()) return false;
    return !Number.isSafeInteger(Number(value)) || Number(value) < 1;
  }
  rowQuantityInvalid(item: DraftProduct): boolean {
    return this.quantityInvalid(item.quantityLimit) ||
      (item.quantityLimit.trim().length > 0 &&
        Number(item.quantityLimit) < item.soldQuantity);
  }
  priceInvalid(item: DraftProduct): boolean {
    if (!item.salePrice.trim()) return false;
    const price = Number(item.salePrice);
    return !Number.isSafeInteger(price) || price <= 0 || price >= item.originalPrice;
  }
  updateBulkDiscount(value: string): void {
    if (!this.editable()) return;
    this.bulkDiscount.set(value);
  }
  applyBulkDiscount(): void {
    const value = this.bulkDiscount();
    if (!this.editable() || this.discountInvalid(value) || !value.trim() || !this.selectedCount()) return;
    const selected = new Set(this.selectedSkus());
    const percentage = Number(value);
    this.form.update(f => ({
      ...f,items:f.items.map(item => selected.has(item.sku)
        ? {...item,discountPercent:value,salePrice:String(this.discountedPrice(item.originalPrice,percentage))}
        : item),
    }));
    this.resetCreateKeyWhenDraftChanges();
    this.validation.set('');this.dirty.set(true);
    this.toast.show('Đã áp dụng mức giảm cho ' + this.selectedCount() + ' SKU được chọn.','success');
  }
  updateItem(index: number, key: 'discountPercent'|'salePrice'|'quantityLimit', value: string): void {
    if (!this.editable()) return;
    this.form.update(f => ({...f,items:f.items.map((item,i) => {
      if (i !== index) return item;
      if (key === 'quantityLimit') return {...item,quantityLimit:value};
      if (key === 'salePrice') {
        const numeric = Number(value);
        const valid = value.trim().length > 0 && Number.isSafeInteger(numeric) &&
          numeric > 0 && numeric < item.originalPrice;
        return {...item,salePrice:value,discountPercent:valid
          ? this.percentageFor(item.originalPrice,numeric) : ''};
      }
      const price = !value.trim() || this.discountInvalid(value)
        ? '' : String(this.discountedPrice(item.originalPrice,Number(value)));
      return {...item,discountPercent:value,salePrice:price};
    })}));
    this.resetCreateKeyWhenDraftChanges();this.validation.set('');this.dirty.set(true);
  }
  removeItem(index: number): void {
    if (!this.editable()) return;
    const sku = this.form().items[index]?.sku;
    this.form.update(f=>({...f,items:f.items.filter((_,i)=>i!==index)}));
    if (sku) this.selectedSkus.update(rows => rows.filter(item => item !== sku));
    this.resetCreateKeyWhenDraftChanges();
    this.dirty.set(true);
  }
  money(value: number): string {return flashSaleMoney(value);}
  moneyFromText(value: string): string {return flashSaleMoney(Number(value));}
  date(value: string): string {return flashSaleDate(value);}

  private payload(): FlashSaleWriteBody | null {
    const f=this.form(),from=utcFromVietnam(f.from),to=utcFromVietnam(f.to);
    if (f.name.trim().length > 120) {
      this.validation.set('Tên chương trình tối đa 120 ký tự.');return null;
    }
    if (!from || !to || Date.parse(to)<=Date.parse(from)) {
      this.validation.set('Vui lòng chọn thời gian kết thúc sau thời gian bắt đầu.');return null;
    }
    const existing = this.original();
    if (existing?.status === 'PUBLISHED' && Date.parse(to) <= Date.now()) {
      this.validation.set('Thời gian kết thúc phải sau thời điểm hiện tại.');return null;
    }
    if ((this.mode === 'create' || existing?.status === 'DRAFT' ||
      !this.startTimeLocked()) && Date.parse(from) < Date.now()) {
      this.validation.set('Thời gian bắt đầu không được ở quá khứ.');return null;
    }
    if (!f.items.length) {
      this.validation.set('Vui lòng thêm ít nhất một sản phẩm vào Flash Sale.');return null;
    }
    const items: FlashSaleItemWrite[]=[];
    for (const row of f.items) {
      const price=Number(row.salePrice),qty=Number(row.quantityLimit);
      if (!row.discountPercent.trim() || this.discountInvalid(row.discountPercent)) {
        this.validation.set('Mức giảm của mỗi SKU phải lớn hơn 0% và nhỏ hơn 100%.');return null;
      }
      if (!Number.isSafeInteger(price)||price<1||price>=row.originalPrice) {
        this.validation.set('Giá Flash Sale phải là số nguyên dương và thấp hơn giá hiện tại của từng SKU.');return null;
      }
      if (!Number.isSafeInteger(qty)||qty<1||qty<row.soldQuantity) {
        this.validation.set('Số lượng chương trình phải là số nguyên dương và không thấp hơn số đã bán.');return null;
      }
      items.push({
        productId:row.productId,variantId:row.variantId,sku:row.sku,
        productName:row.productName,variantLabel:row.variantName,
        originalPrice:row.originalPrice,salePrice:price,quantityLimit:qty,
      });
    }
    return {
      name:f.name.trim() || 'Flash Sale ' + f.from.slice(0,10).split('-').reverse().join('/'),
      description:f.description.trim(),
      startAt:from,endAt:to,items,
      // New campaigns are published immediately and run automatically within their date window.
      // Preserve the operational state of existing published campaigns.
      activationMode: existing?.status === 'PUBLISHED' ? (existing.activationMode || 'AUTO') : 'AUTO',
      isPaused: existing?.status === 'PUBLISHED' ? existing.isPaused : false,
      ...(existing?.version !== undefined ? {expectedVersion: existing.version} : {}),
    };
  }

  async save(): Promise<void> {
    if (!this.editable() || this.saving()) return;
    const body = this.payload();
    if (!body) return;
    if (Date.parse(body.endAt) <= Date.now()) {
      this.validation.set('Thời gian kết thúc đã qua. Vui lòng chọn thời gian hợp lệ trước khi lưu.');
      return;
    }
    this.saving.set(true);
    this.validation.set('');
    try {
      // The BE must create or update + publish in one atomic write. Never
      // silently save a DRAFT as a fallback if publication fails.
      const sale = this.mode === 'create'
        ? await firstValueFrom(this.api.createPublished(body, this.createKey))
        : this.original()?.status === 'DRAFT'
          ? await firstValueFrom(this.api.updateAndPublish(this.id, body))
          : await firstValueFrom(this.api.update(this.id, body));
      if (sale.status !== 'PUBLISHED' ||
          sale.isPaused !== body.isPaused ||
          (sale.activationMode !== undefined && sale.activationMode !== body.activationMode)) {
        throw new Error('Chức năng lưu và kích hoạt Flash Sale chưa đồng bộ. Vui lòng kiểm tra lại trạng thái chương trình.');
      }
      this.original.set(sale);
      this.dirty.set(false);
      this.allowSavedNavigation = true;
      const feedback = this.mode === 'edit'
        ? 'Đã cập nhật chương trình.'
        : sale.isPaused
          ? 'Đã lưu chương trình. Flash Sale sẽ chờ bạn kích hoạt thủ công.'
          : Date.parse(sale.startAt) > Date.now()
            ? 'Đã lưu chương trình. Flash Sale sẽ tự động bắt đầu theo lịch.'
            : 'Đã lưu chương trình. Flash Sale đang trong thời gian diễn ra.';
      this.toast.show(feedback, 'success');
      await this.router.navigate(['/admin/flash-sales', sale.id]);
    } catch (err) {
      this.validation.set(this.message(err,'Không thể lưu Flash Sale. Vui lòng thử lại.'));
    } finally {
      this.saving.set(false);
    }
  }

  async publish(): Promise<void> {
    if (!this.canManage()||this.saving()||!this.original()||this.original()!.status!=='DRAFT')return;
    this.saving.set(true);
    try{
      if (Date.parse(this.original()!.endAt) <= Date.now()) {
        this.toast.show('Chương trình đã hết thời gian áp dụng, không thể kích hoạt.','error');
        return;
      }
      const updated=await firstValueFrom(this.api.publish(this.id,'flash-publish-'+this.id,this.original()!.isPaused,this.modeFor(this.original(),!this.original()!.isPaused)));
      this.original.set(updated);
      this.toast.show(Date.parse(updated.startAt) > Date.now()
        ? 'Chương trình đã được lên lịch và sẽ tự bắt đầu đúng thời gian.'
        : 'Chương trình đã được kích hoạt.','success');
    }catch(err){this.toast.show(this.message(err,'Không thể kích hoạt chương trình.'),'error');}
    finally{this.saving.set(false);}
  }

  async togglePaused(checked: boolean, input: HTMLInputElement): Promise<void> {
    const sale=this.original();
    if (!this.canManage()||!sale||sale.status!=='PUBLISHED'||this.saving()||this.currentState()==='ENDED')return;
    this.saving.set(true);
    try{
      const activationMode: FlashSaleActivationMode = this.isPreStart()
        ? checked ? 'MANUAL' : 'AUTO'
        : this.modeFor(sale, !checked);
      const updated=await firstValueFrom(this.api.setPaused(sale.id,checked,activationMode));
      if (updated.isPaused !== checked ||
          (updated.activationMode !== undefined && updated.activationMode !== activationMode)) {
        throw new Error('BE chưa lưu đúng chế độ kích hoạt của chương trình.');
      }
      this.original.set(updated);
      this.toast.show(this.isPreStart()
        ? checked ? 'Đã chọn kích hoạt thủ công.' : 'Đã chọn tự động hoạt động theo lịch.'
        : checked ? 'Đã tạm ngừng Flash Sale.' : 'Đã tiếp tục Flash Sale.','success');
    }catch(err){
      input.checked = !sale.isPaused;
      this.toast.show(this.message(err,'Không cập nhật được trạng thái chương trình.'),'error');
    }
    finally{this.saving.set(false);}
  }
  async togglePausedFromDetail(): Promise<void> {
    const sale = this.original();
    if (!sale || sale.status !== 'PUBLISHED' || !this.canManage() || this.saving() || this.currentState() === 'ENDED') return;
    const paused = !sale.isPaused;
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(this.api.setPaused(sale.id,paused,sale.activationMode || 'AUTO'));
      if (updated.isPaused !== paused) throw new Error('Backend chưa ghi nhận trạng thái chương trình.');
      this.original.set(updated);
      this.toast.show(paused ? 'Đã tạm ngừng chương trình.' : 'Đã tiếp tục chương trình.','success');
    } catch (err) {
      this.toast.show(this.message(err,'Không thể cập nhật trạng thái.'),'error');
    } finally { this.saving.set(false); }
  }
  cancel(): void {void this.router.navigateByUrl(this.mode==='create'?'/admin/flash-sales':'/admin/flash-sales/'+this.id);}

  canLeavePage(): boolean | Promise<boolean> {
    if (this.allowSavedNavigation) return true;
    if (this.saving()) return false;
    if (!this.dirty()) return true;
    if (this.leaveResolver) return false;
    this.leaveOpen.set(true);
    if(this.focusTimeout) clearTimeout(this.focusTimeout);
    this.focusTimeout=setTimeout(() => this.keepEditingButton?.nativeElement.focus(), 0);
    return new Promise<boolean>(resolve=>this.leaveResolver=resolve);
  }
  resolveLeave(decision: boolean): void {
    const resolve=this.leaveResolver;this.leaveResolver=null;this.leaveOpen.set(false);
    resolve?.(decision);
  }
  @HostListener('document:keydown.escape')
  closeByEscape(): void {
    if (this.leaveOpen()) this.resolveLeave(false);
    else if (this.pickerOpen()) this.closePicker();
  }

  openPicker(): void {
    if (!this.editable())return;
    this.pickerSelected.set([]);this.pickerSearch.set('');
    this.pickerOptions.set([]);this.pickerNextCursor.set(null);
    this.pickerOpen.set(true);this.loadProducts();
    this.focusTimeout = setTimeout(() => this.productSearchInput?.nativeElement.focus(), 0);
  }
  closePicker(): void {
    this.pickerOpen.set(false);++this.pickerRequest;this.pickerSelected.set([]);
    if(this.pickerSearchTimer)clearTimeout(this.pickerSearchTimer);
    if(this.focusTimeout)clearTimeout(this.focusTimeout);
    this.focusTimeout=setTimeout(() => this.addProductTrigger?.nativeElement.focus(), 0);
  }
  @HostListener('document:keydown', ['$event'])
  keepFocusInProductDialog(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || (!this.pickerOpen() && !this.leaveOpen())) return;
    const dialog = this.leaveOpen() ? this.leaveDialog?.nativeElement : this.pickerDialog?.nativeElement;
    if (!dialog) return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
    )).filter(element => element.getClientRects().length > 0);
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();first.focus();
    }
  }

  searchProducts(query: string): void {
    this.pickerSearch.set(query);
    if(this.pickerSearchTimer)clearTimeout(this.pickerSearchTimer);
    this.pickerSearchTimer=setTimeout(()=>{
      this.pickerNextCursor.set(null);this.pickerOptions.set([]);this.loadProducts();
    },300);
  }
  loadProducts(cursor: string|null=null): void {
    if (!this.pickerOpen())return;
    const request=++this.pickerRequest;
    this.pickerLoading.set(true);this.pickerError.set('');
    this.productsApi.listProducts({q:this.pickerSearch(),status:'ACTIVE',limit:20,
      ...(cursor?{cursor}:{}),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:page=>{
        if(request!==this.pickerRequest||!this.pickerOpen())return;
        const products=Array.isArray(page.items)?page.items:[];
        const options:ProductOption[]=products.filter(product=>
          product.status==='ACTIVE' && product.usageType!=='SERVICE_SUPPLY')
          .flatMap((product:AdminProduct)=>product.variants.filter(v=>v.status==='ACTIVE')
            .map((v:ProductVariant)=>this.toOption(product,v)));
        this.pickerOptions.update(old=>cursor?[...old,...options]:options);
        this.pickerNextCursor.set(page.nextCursor||null);
        this.pickerLoading.set(false);
      },
      error:err=>{
        if(request!==this.pickerRequest)return;
        this.pickerLoading.set(false);
        this.pickerError.set(adminErrorMessage(err,'Không tải được sản phẩm.'));
      },
    });
  }
  private toOption(p:AdminProduct,v:ProductVariant): ProductOption {
    // Prefer an image assigned to this SKU; otherwise inherit the product main image.
    const image=v.image || p.images?.find(img=>img.isPrimary)?.url || p.images?.[0]?.url || '';
    return {
      key:p.id+'::'+v.id,productId:p.id,variantId:v.id,
      productName:p.name,variantName:v.label,sku:v.sku,imageUrl:image??'',
      price:Number(v.finalPrice??v.price),
      totalStock:typeof v.availableStock === 'number' ? v.availableStock : null,
    };
  }
  isInForm(opt:ProductOption):boolean{
    return this.form().items.some(item=>item.productId===opt.productId&&item.variantId===opt.variantId);
  }
  isPending(opt:ProductOption):boolean{return this.pickerSelected().some(item=>item.key===opt.key);}
  chooseOption(opt:ProductOption,checked:boolean):void {
    if (this.isInForm(opt))return;
    this.pickerSelected.update(a=>checked?[...a,opt]:a.filter(item=>item.key!==opt.key));
  }
  applySelection():void {
    if(!this.editable())return;
    const picked=this.pickerSelected().filter(opt=>!this.isInForm(opt));
    this.form.update(f=>({
      ...f,items:[...f.items,...picked.map(opt=>({
        productId:opt.productId,variantId:opt.variantId,sku:opt.sku,
        productName:opt.productName,variantName:opt.variantName,imageUrl:opt.imageUrl,
        originalPrice:opt.price,discountPercent:'',salePrice:'',quantityLimit:'',
        soldQuantity:0,
        totalStock:opt.totalStock,
      }))],
    }));
    if(picked.length){
      this.selectedSkus.update(current => [...new Set([...current,...picked.map(item => item.sku)])]);
      this.resetCreateKeyWhenDraftChanges();this.dirty.set(true);this.validation.set('');
    }
    this.closePicker();
  }
}
