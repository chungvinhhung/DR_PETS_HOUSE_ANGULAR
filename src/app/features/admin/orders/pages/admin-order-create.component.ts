import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
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
  private readonly toast = inject(AdminToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private customerRequest = 0;
  private productRequest = 0;
  private productTimer: ReturnType<typeof setTimeout> | null = null;

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
  readonly reviewAttempted = signal(false);
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
  closeAddressOnEscape(): void { this.closeAddressDialog(); }

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

  editProductQuery(value: string): void {
    this.productQuery.set(value);
    this.productResults.set([]);
    this.productError.set(false);
    const version = ++this.productRequest;
    if (this.productTimer) clearTimeout(this.productTimer);
    if (!value.trim()) {
      this.productLoading.set(false);
      return;
    }
    this.productLoading.set(true);
    this.productTimer = setTimeout(() => this.queryProducts(version), 280);
  }

  queryProducts(version = ++this.productRequest): void {
    if (this.productTimer !== null) clearTimeout(this.productTimer);
    const text = this.productQuery().trim();
    if (!text) {
      this.productLoading.set(false);
      this.productResults.set([]);
      return;
    }
    this.productLoading.set(true);
    this.productError.set(false);
    this.api.searchProducts(text).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (version !== this.productRequest) return;
        const candidates = data.items.flatMap(item => this.api.saleVariants(item));
        const q = text.toLocaleLowerCase('vi');
        // Search on the backend and match returned variant SKU too.
        this.productResults.set(candidates.filter(item =>
          [item.productName, item.label, item.sku].some(x => x.toLocaleLowerCase('vi').includes(q))
        ));
        this.productLoading.set(false);
      },
      error: error => {
        if (version !== this.productRequest) return;
        this.productLoading.set(false);
        this.productResults.set([]);
        this.productError.set(true);
        this.toast.show(adminErrorMessage(error, 'Chưa tải được danh sách sản phẩm.'));
      },
    });
  }

  addProduct(choice: OrderVariantChoice): void {
    const current = this.lines();
    this.invalidateDraftPricing();
    const existing = current.find(line => line.variantId === choice.variantId && line.productId === choice.productId);
    if (existing) {
      this.changeQuantity(existing, existing.quantity + 1);
    } else {
      this.lines.set([...current, { ...choice, quantity: 1 }]);
    }
    this.productQuery.set('');
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
    this.voucherCode.set(value.toUpperCase().trimStart());
    this.voucherPreviewState.set('idle');
  }

  clearVoucher(): void {
    this.voucherCode.set('');
    this.voucherPreviewState.set('idle');
  }

  private invalidateDraftPricing(): void {
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
    // The current /vouchers/validate evaluates the authenticated Customer's cart.
    // Never call it using the Admin session as that could validate the wrong cart.
    this.voucherPreviewState.set('unverified');
  }

  askCancel(): void {
    if (this.hasUnsavedChanges()) {
      this.cancelDialogOpen.set(true);
      return;
    }
    void this.router.navigateByUrl('/admin/orders');
  }

  closeCancel(): void { this.cancelDialogOpen.set(false); }

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
    void this.router.navigateByUrl('/admin/orders');
  }

  reviewDraft(): void {
    this.reviewAttempted.set(true);
    if (this.isDraftValid()) {
      this.toast.show('Thông tin bản nháp đã đầy đủ. Tổng tiền cuối cùng sẽ được xác nhận khi hệ thống hỗ trợ tạo đơn.', 'info');
    }
  }

  readonly missingShippingAddress = computed(() =>
    !this.shippingLine1().trim() || !this.shippingCity().trim() || !this.shippingDistrict().trim());
  readonly showAddressContractWarning = computed(() => this.selectedCustomer() !== null);
}
