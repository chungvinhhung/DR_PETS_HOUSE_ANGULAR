import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { BranchApiRecord, BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
import { AdminOrderCheckoutService, AdminOrderQuote, AdminOrderQuoteRequest, AdminOrderCommitRequest } from '../services/admin-order-checkout.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
  AdminOrderCreateLookupService, OrderCustomerLookup,
} from '../services/admin-order-create-lookup.service';

interface OrderVariantChoice {
  productId: string;
  variantId: string;
  productName: string;
  label: string;
  sku: string;
  price: number;
  availableStock?: number;
  imageUrl?: string;
}
interface OrderDraftLine extends OrderVariantChoice { quantity: number; }
interface ShippingAddressDraft {
  recipientName: string;
  recipientPhone: string;
  city: string;
  district: string;
  ward: string;
  line1: string;
}
type AddressDialogMode = 'add' | 'edit' | 'choose';
type OnlineProvider = 'MOMO' | 'ZALOPAY' | 'VNPAY' | 'BANK_TRANSFER' | 'ATM' | 'CARD';
type VoucherPreviewState = 'idle' | 'unverified';
type LookupState = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('84') && digits.length >= 11 ? '0' + digits.slice(2) : digits;
};

@Component({
  selector: 'app-admin-order-create',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-order-create.component.html',
  styleUrl: './admin-order-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderCreateComponent {
  private readonly api = inject(AdminOrderCreateLookupService);
  private readonly checkout = inject(AdminOrderCheckoutService);
  private readonly branchesApi = inject(BranchManagementApiService);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private customerRequest = 0;
  private productRequest = 0;
  private pendingExitDecision: ((allow: boolean) => void) | null = null;
  private productTimer: ReturnType<typeof setTimeout> | null = null;

  readonly branches=signal<BranchApiRecord[]>([]);
  readonly branchId=signal('');
  readonly branchLoadError=signal(false);
  readonly quoteState=signal<'idle'|'loading'|'ready'|'error'>('idle');
  readonly quoteError=signal('');
  readonly quote=signal<AdminOrderQuote|null>(null);
  readonly quoteFingerprint=signal('');
  readonly confirmCreateOpen=signal(false);
  readonly saving=signal(false);
  readonly created=signal(false);
  private quoteRequest=0;
  private createKey: string|null=null;
  readonly canQuote=computed(()=>this.session.user()?.systemRole==='ADMIN' && this.lines().length>0 && !this.hasInvalidQuantities() && !!this.branchId());
  readonly quoteIsCurrent=computed(()=>!!this.quote() && this.quoteState()==='ready' && this.quoteFingerprint()===this.getQuoteFingerprint() && Date.now()<Date.parse(this.quote()!.quoteExpiresAt));
  readonly canSubmit=computed(()=>this.quoteIsCurrent() && this.isDraftValid() && this.quote()!.eligible && this.quote()!.availability.canFulfillEntireCart && (!this.voucherCode().trim() || this.quote()!.pricing.voucherDiscount>0) && this.session.user()?.systemRole==='ADMIN' && !!this.selectedCustomer() && !this.saving());
  readonly lookupPhone = signal('');
  readonly lookupState = signal<LookupState>('idle');
  readonly lookupIncomplete = signal(false);
  readonly lookupResults = signal<OrderCustomerLookup[]>([]);
  readonly selectedCustomer = signal<OrderCustomerLookup | null>(null);
  readonly customerName = signal('');
  readonly customerPhone = signal('');
  readonly customerEmail = signal('');
  readonly shippingLine1 = signal('');
  readonly shippingCity = signal('');
  readonly shippingDistrict = signal('');
  readonly shippingWard = signal('');
  readonly shippingRecipientName = signal('');
  readonly shippingRecipientPhone = signal('');
  readonly addressDialog = signal<AddressDialogMode | null>(null);
  readonly addressDialogError = signal('');
  readonly addressDraft = signal<ShippingAddressDraft>(this.emptyAddress());
  readonly addressWasConfirmed = signal(false);
  readonly shippingAddressDescription = computed(() => [
    this.shippingLine1(), this.shippingWard(), this.shippingDistrict(), this.shippingCity(),
  ].filter(part => Boolean(part.trim())).join(', '));
  // BE /customers does not return saved addresses yet; show no fabricated address choices.
  readonly savedAddresses = signal<ShippingAddressDraft[]>([]);
  readonly productQuery = signal('');
  readonly productLookupOpen = signal(false);
  readonly productHighlighted = signal(0);
  readonly productLoading = signal(false);
  readonly productError = signal(false);
  readonly productResults = signal<OrderVariantChoice[]>([]);
  readonly lines = signal<OrderDraftLine[]>([]);
  readonly paymentMethod = signal<'COD' | 'ONLINE_MOCK'>('COD');
  readonly onlineProvider = signal<OnlineProvider | null>(null);
  readonly onlineProviderChoices: ReadonlyArray<{ key: OnlineProvider; label: string }> = [
    { key: 'MOMO', label: 'MoMo' },
    { key: 'ZALOPAY', label: 'ZaloPay' },
    { key: 'VNPAY', label: 'VNPay' },
    { key: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
    { key: 'ATM', label: 'Thẻ ATM' },
    { key: 'CARD', label: 'Thẻ tín dụng/ghi nợ' },
  ];
  readonly voucherCode = signal('');
  readonly voucherPreviewState = signal<VoucherPreviewState>('idle');
  readonly cancelDialogOpen = signal(false);
  readonly note = signal('');
  // Listing finalPrice includes the product's own discount; BE remains the source
  // of truth for voucher allocation, stock/branch availability and order total.
  readonly subtotal = computed(() => this.lines().reduce((sum, line) =>
    sum + (Number.isSafeInteger(line.quantity) && line.quantity > 0
      ? line.price * line.quantity : 0), 0));
  readonly reviewIssues = computed((): string[] => {
    const issues: string[] = [];
    const phone = normalizePhone(this.lookupPhone());
    if (phone.length < 9 || phone.length > 15) issues.push('Nhập số điện thoại khách hàng hợp lệ.');
    else if (!['found','not-found'].includes(this.lookupState()))
      issues.push('Tra cứu số điện thoại khách hàng trước khi tiếp tục.');
    if (this.lookupState() === 'found' && !this.selectedCustomer())
      issues.push('Chọn khách hàng từ kết quả tra cứu.');
    if (this.selectedCustomer()?.accountStatus === 'BLOCKED')
      issues.push('Tài khoản khách hàng đang bị khóa.');
    if (!this.customerName().trim()) issues.push('Nhập họ và tên khách hàng.');
    if (this.customerEmail().trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.customerEmail().trim()))
      issues.push('Địa chỉ email chưa hợp lệ.');
    if (this.lines().length === 0) issues.push('Thêm ít nhất một sản phẩm vào đơn hàng.');
    if (this.hasInvalidQuantities()) issues.push('Kiểm tra lại số lượng sản phẩm trong đơn.');
    if (this.missingShippingAddress()) issues.push('Nhập đầy đủ địa chỉ giao hàng.');
    if (this.selectedCustomer() && !this.addressWasConfirmed())
      issues.push('Chọn hoặc xác nhận địa chỉ nhận hàng.');
    if (this.paymentMethod() === 'ONLINE_MOCK' && !this.onlineProvider())
      issues.push('Chọn một hình thức thanh toán trực tuyến.');
    return issues;
  });
  readonly isDraftValid = computed(() => this.reviewIssues().length === 0);
  readonly hasInvalidQuantities = computed(() => this.lines().some(item =>
    !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
    (item.availableStock !== undefined && item.quantity > item.availableStock)));
  readonly hasUnsavedChanges = computed(() => Boolean(
    this.lookupPhone() || this.customerName() || this.customerEmail() || this.shippingLine1() ||
    this.shippingCity() || this.shippingDistrict() || this.shippingWard() ||
    this.lines().length || this.voucherCode() || this.note()
  ));

  constructor() {
    this.loadBranches();
    this.destroyRef.onDestroy(() => {
      if (this.productTimer !== null) clearTimeout(this.productTimer);
      this.customerRequest += 1;
      this.productRequest += 1;
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  preventUnsavedReload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  readonly price = (amount: number): string =>
    new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

  editLookupPhone(value: string): void {
    // Changing the search number invalidates previously selected customer and address.
    this.customerRequest += 1;
    this.invalidateDraftPricing();
    this.lookupPhone.set(value);
    this.customerPhone.set(value);
    this.selectedCustomer.set(null);
    this.lookupResults.set([]);
    this.lookupIncomplete.set(false);
    this.lookupState.set('idle');
    this.customerName.set('');
    this.customerEmail.set('');
    this.clearShippingAddress();
  }

  lookupCustomer(): void {
    const phone = normalizePhone(this.lookupPhone());
    if (phone.length < 9 || phone.length > 15) {
      this.toast.show('Vui lòng nhập số điện thoại khách hàng hợp lệ.');
      return;
    }
    const version = ++this.customerRequest;
    this.lookupState.set('loading');
    this.lookupIncomplete.set(false);
    this.lookupResults.set([]);
    this.api.searchCustomers(phone).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (version !== this.customerRequest) return;
        // Backend search is partial across phone/email; only accept exact phone matches.
        const matches = data.items.filter(row => normalizePhone(row.phone ?? '') === phone);
        // /customers is a partial search with a maximum page size. If more pages
        // remain, absence of an exact match is not evidence of a new customer.
        if (!matches.length && data.nextCursor) {
          this.lookupIncomplete.set(true);
          this.lookupState.set('error');
          return;
        }
        this.lookupResults.set(matches);
        this.lookupState.set(matches.length ? 'found' : 'not-found');
        if (matches.length === 1) this.selectCustomer(matches[0]);
      },
      error: error => {
        if (version !== this.customerRequest) return;
        this.lookupState.set('error');
        this.toast.show(adminErrorMessage(error, 'Chưa tra cứu được khách hàng.'));
      },
    });
  }

  selectCustomer(customer: OrderCustomerLookup): void {
    this.customerRequest += 1;
    this.invalidateDraftPricing();
    this.selectedCustomer.set(customer);
    this.customerName.set(customer.fullName ?? '');
    this.customerPhone.set(customer.phone ?? this.lookupPhone());
    this.customerEmail.set(customer.email ?? '');
    this.lookupPhone.set(customer.phone ?? this.lookupPhone());
    this.lookupResults.set([]);
    this.lookupState.set('found');
    this.clearShippingAddress();
    this.shippingRecipientName.set(customer.fullName ?? '');
    this.shippingRecipientPhone.set(customer.phone ?? this.lookupPhone());
    // /customers currently exposes no saved/default address; do not fabricate one.
  }

  updateCustomerName(value: string): void { this.customerName.set(value); }
  updateCustomerPhone(value: string): void {
    const previousPhone = this.customerPhone();
    if (value === previousPhone && value === this.lookupPhone()) return;
    // Both the lookup field and customer form represent the same contact number.
    // A changed phone must invalidate any previously verified lookup result.
    const priorCustomer = this.selectedCustomer();
    this.customerRequest += 1;
    this.invalidateDraftPricing();
    this.customerPhone.set(value);
    this.lookupPhone.set(value);
    this.selectedCustomer.set(null);
    this.lookupResults.set([]);
    this.lookupIncomplete.set(false);
    this.lookupState.set('idle');
    if (priorCustomer) {
      // Do not retain another customer's read-only profile or confirmed address.
      this.customerName.set('');
      this.customerEmail.set('');
      this.clearShippingAddress();
    } else if (this.shippingRecipientPhone() === previousPhone) {
      this.shippingRecipientPhone.set(value);
      this.addressWasConfirmed.set(false);
    }
  }
  updateCustomerEmail(value: string): void { this.customerEmail.set(value); }
  updateShippingLine1(value: string): void { this.shippingLine1.set(value); this.addressWasConfirmed.set(false); }
  updateShippingCity(value: string): void { this.shippingCity.set(value); this.addressWasConfirmed.set(false); }
  updateShippingDistrict(value: string): void { this.shippingDistrict.set(value); this.addressWasConfirmed.set(false); }
  updateShippingWard(value: string): void { this.shippingWard.set(value); this.addressWasConfirmed.set(false); }

  private emptyAddress(): ShippingAddressDraft {
    return { recipientName: '', recipientPhone: '', city: '', district: '', ward: '', line1: '' };
  }

  private clearShippingAddress(): void {
    this.shippingLine1.set('');
    this.shippingCity.set('');
    this.shippingDistrict.set('');
    this.shippingWard.set('');
    this.shippingRecipientName.set('');
    this.shippingRecipientPhone.set('');
    this.addressWasConfirmed.set(false);
    this.addressDialog.set(null);
    this.addressDraft.set(this.emptyAddress());
    this.addressDialogError.set('');
  }

  openAddressDialog(mode: AddressDialogMode): void {
    this.addressDialogError.set('');
    this.addressDraft.set({
      recipientName: mode === 'add' ? this.customerName() : (this.shippingRecipientName() || this.customerName()),
      recipientPhone: mode === 'add' ? this.customerPhone() : (this.shippingRecipientPhone() || this.customerPhone()),
      city: mode === 'add' ? '' : this.shippingCity(),
      district: mode === 'add' ? '' : this.shippingDistrict(),
      ward: mode === 'add' ? '' : this.shippingWard(),
      line1: mode === 'add' ? '' : this.shippingLine1(),
    });
    this.addressDialog.set(mode);
  }

  @HostListener('document:keydown.escape')
  closeAddressOnEscape(): void {
    if (this.cancelDialogOpen()) this.closeCancel();
    else this.closeAddressDialog();
  }

  closeAddressDialog(): void {
    this.addressDialog.set(null);
    this.addressDialogError.set('');
  }

  editAddressField(key: keyof ShippingAddressDraft, value: string): void {
    this.addressDraft.update(draft => ({ ...draft, [key]: value }));
    this.addressDialogError.set('');
  }

  saveAddressDraft(): void {
    const draft = this.addressDraft();
    if (!draft.recipientName.trim() || !draft.recipientPhone.trim() ||
        normalizePhone(draft.recipientPhone).length < 9 ||
        !draft.city.trim() || !draft.district.trim() || !draft.line1.trim()) {
      this.addressDialogError.set('Vui lòng nhập đầy đủ người nhận, số điện thoại và địa chỉ giao hàng.');
      return;
    }
    this.shippingRecipientName.set(draft.recipientName.trim());
    this.shippingRecipientPhone.set(draft.recipientPhone.trim());
    this.shippingCity.set(draft.city.trim());
    this.shippingDistrict.set(draft.district.trim());
    this.shippingWard.set(draft.ward.trim());
    this.shippingLine1.set(draft.line1.trim());
    this.addressWasConfirmed.set(true);
    this.closeAddressDialog();
  }

  chooseAddress(draft: ShippingAddressDraft): void {
    this.addressDraft.set(draft);
    this.saveAddressDraft();
  }
  updateNote(value: string): void { this.note.set(value); }

  openProductLookup(): void {
    if (this.productLookupOpen()) return;
    this.productLookupOpen.set(true);
    this.productHighlighted.set(0);
    // An empty query intentionally retrieves active products immediately,
    // as in the inventory stock-receipt product picker.
    this.queryProducts();
  }

  closeProductLookup(): void {
    if (!this.productLookupOpen()) return;
    this.productLookupOpen.set(false);
    this.productRequest++;
    if (this.productTimer !== null) clearTimeout(this.productTimer);
    this.productTimer = null;
    this.productLoading.set(false);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (event.target instanceof Element &&
        !event.target.closest('.create-order__products-lookup')) {
      this.closeProductLookup();
    }
  }

  onProductLookupKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeProductLookup();
      return;
    }
    const options = this.productResults().filter(
      option => option.availableStock === undefined || option.availableStock > 0,
    );
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.productLookupOpen()) {
        this.openProductLookup();
        return;
      }
      if (options.length) {
        const currentId = this.productResults()[this.productHighlighted()]?.variantId;
        const currentIndex = options.findIndex(item => item.variantId === currentId);
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = options[(Math.max(0, currentIndex) + delta + options.length) % options.length];
        this.productHighlighted.set(this.productResults().indexOf(next));
      }
    } else if (event.key === 'Enter' && this.productLookupOpen() && options.length) {
      event.preventDefault();
      const highlighted = this.productResults()[this.productHighlighted()];
      this.addProduct(highlighted && options.includes(highlighted) ? highlighted : options[0]);
    }
  }

  editProductQuery(value: string): void {
    this.productQuery.set(value);
    this.productLookupOpen.set(true);
    this.productHighlighted.set(0);
    this.productResults.set([]);
    this.productError.set(false);
    const version = ++this.productRequest;
    if (this.productTimer !== null) clearTimeout(this.productTimer);
    if (!value.trim()) {
      // Clearing the search restores the unfiltered product list.
      this.queryProducts(version);
      return;
    }
    this.productLoading.set(true);
    this.productTimer = setTimeout(() => this.queryProducts(version), 280);
  }

  queryProducts(version = ++this.productRequest): void {
    if (this.productTimer !== null) clearTimeout(this.productTimer);
    const text = this.productQuery().trim();
    // Empty input loads the first active products without sending the q parameter.
    this.productLoading.set(true);
    this.productError.set(false);
    this.api.searchProducts(text).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (version !== this.productRequest) return;
        const candidates = data.items.flatMap(item => this.api.saleVariants(item));
        const q = text.toLocaleLowerCase('vi');
        // Search on the backend and match returned variant SKU too.
        // Without a search term, show all active sellable results in the page.
        this.productResults.set(q
          ? candidates.filter(item =>
              [item.productName, item.label, item.sku].some(x => x.toLocaleLowerCase('vi').includes(q)))
          : candidates);
        this.productHighlighted.set(0);
        this.productLoading.set(false);
      },
      error: () => {
        if (version !== this.productRequest) return;
        this.productLoading.set(false);
        this.productResults.set([]);
        this.productError.set(true);
        // Lookup failure is shown inline next to "Thử lại", not as form validation.
      },
    });
  }

  addProduct(choice: OrderVariantChoice): void {
    if (choice.availableStock !== undefined && choice.availableStock <= 0) {
      this.toast.show('Sản phẩm này hiện đã hết hàng.');
      return;
    }
    const current = this.lines();
    this.invalidateDraftPricing();
    const existing = current.find(line => line.variantId === choice.variantId && line.productId === choice.productId);
    if (existing) {
      this.changeQuantity(existing, existing.quantity + 1);
    } else {
      this.lines.set([...current, { ...choice, quantity: 1 }]);
    }
    this.productQuery.set('');
    this.productLookupOpen.set(false);
    this.productResults.set([]);
    this.productLoading.set(false);
    this.productError.set(false);
    this.productRequest += 1;
    if (this.productTimer !== null) clearTimeout(this.productTimer);
  }

  changeQuantity(line: OrderDraftLine, quantity: number): void {
    this.invalidateDraftPricing();
    // Preserve an invalid attempted quantity so the user sees the validation.
    const parsed = Number.isFinite(quantity) ? quantity : 0;
    this.lines.update(items => items.map(item =>
      item.productId === line.productId && item.variantId === line.variantId
        ? { ...item, quantity: parsed }
        : item
    ));
  }

  removeProduct(line: OrderDraftLine): void {
    this.invalidateDraftPricing();
    this.lines.update(items => items.filter(item =>
      !(item.productId === line.productId && item.variantId === line.variantId)));
  }

  togglePayment(method: 'COD' | 'ONLINE_MOCK'): void {
    this.paymentMethod.set(method);
    if (method === 'COD') this.onlineProvider.set(null);
  }

  providerIcon(method: OnlineProvider): string {
    const icons: Record<OnlineProvider, string> = {
      MOMO: '/assets/admin-order/payment-momo.svg',
      ZALOPAY: '/assets/admin-order/payment-zalopay.svg',
      VNPAY: '/assets/admin-order/payment-vnpay.svg',
      BANK_TRANSFER: '/assets/admin-order/payment-bank.svg',
      ATM: '/assets/admin-order/payment-atm.svg',
      CARD: '/assets/admin-order/payment-card.svg',
    };
    return icons[method];
  }

  chooseOnlineProvider(method: OnlineProvider): void {
    this.paymentMethod.set('ONLINE_MOCK');
    this.onlineProvider.set(method);
  }

  updateVoucher(value: string): void {
    this.invalidateDraftPricing();
    this.voucherCode.set(value.toUpperCase().trimStart());
    this.voucherPreviewState.set('idle');
  }

  clearVoucher(): void {
    this.invalidateDraftPricing();
    this.voucherCode.set('');
    this.voucherPreviewState.set('idle');
  }

  private invalidateDraftPricing(): void {
    ++this.quoteRequest;
    this.createKey=null;
    this.quote.set(null);
    this.quoteFingerprint.set('');
    this.quoteState.set('idle');
    this.quoteError.set('');
    this.voucherPreviewState.set('idle');
  }

  explainVoucher(): void {
    if (!this.voucherCode().trim()) {
      this.toast.show('Vui lòng nhập mã giảm giá.');
      return;
    }
    if (!this.lines().length || this.hasInvalidQuantities()) {
      this.toast.show('Vui lòng chọn sản phẩm và kiểm tra số lượng trước khi áp dụng mã.');
      return;
    }
    this.requestQuote();
  }

  private loadBranches():void {
    this.branchesApi.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:branches=>{
        this.branches.set(branches.filter(b=>b.status==='ACTIVE'));
        this.branchLoadError.set(false);
      },
      error:()=>this.branchLoadError.set(true),
    });
  }
  selectBranch(id:string):void {
    if(this.branchId()===id)return;
    this.branchId.set(id);this.invalidateDraftPricing();
  }
  private getQuoteFingerprint():string {
    return JSON.stringify({
      branchId:this.branchId(),customerId:this.selectedCustomer()?.id||null,
      items:this.lines().map(l=>[l.productId,l.variantId,l.quantity]),
      voucherCode:this.voucherCode().trim(),
    });
  }
  private quoteBody():AdminOrderQuoteRequest {
    return {
      branchId:this.branchId(),
      ...(this.selectedCustomer()?{customerId:this.selectedCustomer()!.id}:{}),
      items:this.lines().map(l=>({productId:l.productId,variantId:l.variantId,quantity:l.quantity})),
      ...(this.voucherCode().trim()?{voucherCode:this.voucherCode().trim()}:{}),
    };
  }
  requestQuote():void {
    if(!this.canQuote() || this.quoteState()==='loading') {
      this.toast.show('Vui lòng chọn chi nhánh và sản phẩm hợp lệ trước khi xem báo giá.');
      return;
    }
    const version=++this.quoteRequest;
    const fingerprint=this.getQuoteFingerprint();
    this.quote.set(null);this.quoteState.set('loading');this.quoteError.set('');
    this.checkout.quote(this.quoteBody()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:quote=>{
        if(version!==this.quoteRequest || fingerprint!==this.getQuoteFingerprint())return;
        this.quote.set(quote);this.quoteFingerprint.set(fingerprint);
        this.quoteState.set('ready');
        if(!quote.eligible || !quote.availability.canFulfillEntireCart)
          this.toast.show('Một số sản phẩm không đủ tồn kho tại chi nhánh. Vui lòng kiểm tra lại.');
        else if(this.voucherCode().trim() && quote.pricing.voucherDiscount===0)
          this.toast.show('Mã giảm giá chưa đủ điều kiện áp dụng.');
        else this.toast.show('Đã cập nhật báo giá từ hệ thống.','success');
      },
      error:err=>{
        if(version!==this.quoteRequest)return;
        this.quoteState.set('error');
        this.quoteError.set(adminErrorMessage(err,'Chưa lấy được báo giá. Vui lòng thử lại.'));
        this.toast.show(this.quoteError(),'error');
      },
    });
  }
  reviewCreate():void {
    if(!this.canSubmit()){
      if(!this.selectedCustomer())this.toast.show('Hiện chỉ hỗ trợ tạo đơn cho khách đã có tài khoản. Khách vãng lai sẽ được mở sau khi xác minh luồng kích hoạt.');
      else if(this.session.user()?.systemRole!=='ADMIN')this.toast.show('Chức năng tạo đơn hiện đang giới hạn cho quản trị viên.');
      else if(!this.isDraftValid())this.toast.show(this.reviewIssues()[0]||'Vui lòng kiểm tra thông tin đơn hàng.');
      else this.toast.show('Vui lòng lấy báo giá hợp lệ, còn hiệu lực trước khi tạo đơn.');
      return;
    }
    this.confirmCreateOpen.set(true);
  }
  closeCreate():void{if(!this.saving())this.confirmCreateOpen.set(false);}
  submitCreate():void {
    if(!this.confirmCreateOpen() || !this.canSubmit() || this.saving())return;
    const q=this.quote()!;
    if(q.fulfillmentBranchId!==this.branchId()){
      this.toast.show('Chi nhánh báo giá chưa khớp. Vui lòng kiểm tra lại.');return;
    }
    const body:AdminOrderCommitRequest={
      ...this.quoteBody(),paymentMethod:this.paymentMethod(),
      shippingAddress:{
        recipientName:this.shippingRecipientName()||this.customerName(),
        phone:this.shippingRecipientPhone()||this.customerPhone(),
        line1:this.shippingLine1(),ward:this.shippingWard(),
        district:this.shippingDistrict(),city:this.shippingCity(),
      },
      note:this.note().trim(),
    };
    this.createKey??=crypto.randomUUID();
    this.saving.set(true);
    this.checkout.commit(body,this.createKey).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:response=>{
        this.saving.set(false);this.confirmCreateOpen.set(false);
        if(!response?.order?.id || !response.order.code){
          this.toast.show('Đơn đã được gửi nhưng chưa xác nhận được kết quả. Vui lòng kiểm tra danh sách đơn trước khi thử lại.','error');
          return;
        }
        this.created.set(true);
        this.toast.show('Tạo đơn '+response.order.code+' thành công.','success');
        void this.router.navigateByUrl('/admin/orders/'+encodeURIComponent(response.order.id));
      },
      error:err=>{
        this.saving.set(false);
        this.toast.show(adminErrorMessage(err,'Chưa xác nhận được kết quả tạo đơn. Vui lòng kiểm tra danh sách đơn trước khi thử lại.'),'error');
        // Reuse the same idempotency key on retry, never create a second key.
      },
    });
  }

  canLeavePage(): boolean | Promise<boolean> {
    if (this.created() || !this.hasUnsavedChanges()) return true;
    // A single in-app confirmation applies to Cancel, Back and sidebar links.
    if (this.pendingExitDecision) return false;
    this.cancelDialogOpen.set(true);
    return new Promise<boolean>(resolve => { this.pendingExitDecision = resolve; });
  }

  askCancel(): void {
    void this.router.navigateByUrl('/admin/orders');
  }

  closeCancel(): void {
    this.cancelDialogOpen.set(false);
    this.pendingExitDecision?.(false);
    this.pendingExitDecision = null;
  }

  confirmCancel(): void {
    // Intentional navigation after user consent. Clear state so the browser
    // unload warning is not triggered on the way out.
    this.cancelDialogOpen.set(false);
    this.lookupPhone.set('');
    this.customerName.set('');
    this.customerEmail.set('');
    this.lines.set([]);
    this.voucherCode.set('');
    this.note.set('');
    this.clearShippingAddress();
    const decide = this.pendingExitDecision;
    this.pendingExitDecision = null;
    if (decide) decide(true);
    else void this.router.navigateByUrl('/admin/orders');
  }

  readonly missingShippingAddress = computed(() =>
    !this.shippingLine1().trim() || !this.shippingCity().trim() || !this.shippingDistrict().trim());
  readonly showAddressContractWarning = computed(() => this.selectedCustomer() !== null);
}
