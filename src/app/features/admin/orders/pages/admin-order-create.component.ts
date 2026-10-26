import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
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
  private readonly destroyRef = inject(DestroyRef);
  private customerRequest = 0;
  private productRequest = 0;
  private productTimer: ReturnType<typeof setTimeout> | null = null;

  readonly lookupPhone = signal('');
  readonly lookupState = signal<LookupState>('idle');
  readonly lookupResults = signal<OrderCustomerLookup[]>([]);
  readonly selectedCustomer = signal<OrderCustomerLookup | null>(null);
  readonly customerName = signal('');
  readonly customerPhone = signal('');
  readonly customerEmail = signal('');
  readonly shippingLine1 = signal('');
  readonly shippingCity = signal('');
  readonly addressEditorOpen = signal(true);
  readonly productQuery = signal('');
  readonly productLoading = signal(false);
  readonly productResults = signal<OrderVariantChoice[]>([]);
  readonly lines = signal<OrderDraftLine[]>([]);
  readonly paymentMethod = signal<'COD' | 'ONLINE_MOCK'>('COD');
  readonly voucherCode = signal('');
  readonly note = signal('');
  readonly subtotal = computed(() => this.lines().reduce((sum, line) => sum + line.price * line.quantity, 0));
  readonly hasInvalidQuantities = computed(() => this.lines().some(item =>
    !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
    (item.availableStock !== undefined && item.quantity > item.availableStock)));
  readonly hasUnsavedChanges = computed(() => Boolean(
    this.lookupPhone() || this.customerName() || this.customerEmail() || this.shippingLine1() ||
    this.shippingCity() || this.lines().length || this.voucherCode() || this.note()
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
    this.lookupState.set('idle');
    this.customerName.set('');
    this.customerEmail.set('');
    this.shippingLine1.set('');
    this.shippingCity.set('');
    this.addressEditorOpen.set(true);
  }

  lookupCustomer(): void {
    const phone = normalizePhone(this.lookupPhone());
    if (phone.length < 9 || phone.length > 15) {
      this.toast.show('Vui lòng nhập số điện thoại khách hàng hợp lệ.');
      return;
    }
    const version = ++this.customerRequest;
    this.lookupState.set('loading');
    this.lookupResults.set([]);
    this.api.searchCustomers(phone).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (version !== this.customerRequest) return;
        // Backend search is partial across phone/email; only accept exact phone matches.
        const matches = data.items.filter(row => normalizePhone(row.phone ?? '') === phone);
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
    this.shippingLine1.set('');
    this.shippingCity.set('');
    // /customers currently exposes no saved/default address; do not fabricate one.
    this.addressEditorOpen.set(true);
  }

  updateCustomerName(value: string): void { this.customerName.set(value); }
  updateCustomerEmail(value: string): void { this.customerEmail.set(value); }
  updateShippingLine1(value: string): void { this.shippingLine1.set(value); }
  updateShippingCity(value: string): void { this.shippingCity.set(value); }
  updateVoucher(value: string): void { this.voucherCode.set(value); }
  updateNote(value: string): void { this.note.set(value); }

  editProductQuery(value: string): void {
    this.productQuery.set(value);
    this.productResults.set([]);
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
        this.toast.show(adminErrorMessage(error, 'Chưa tải được danh sách sản phẩm.'));
      },
    });
  }

  addProduct(choice: OrderVariantChoice): void {
    const current = this.lines();
    const existing = current.find(line => line.variantId === choice.variantId && line.productId === choice.productId);
    if (existing) {
      this.changeQuantity(existing, existing.quantity + 1);
    } else {
      this.lines.set([...current, { ...choice, quantity: 1 }]);
    }
    this.productQuery.set('');
    this.productResults.set([]);
    this.productLoading.set(false);
    this.productRequest += 1;
    if (this.productTimer !== null) clearTimeout(this.productTimer);
  }

  changeQuantity(line: OrderDraftLine, quantity: number): void {
    // Preserve an invalid attempted quantity so the user sees the validation.
    const parsed = Number.isFinite(quantity) ? quantity : 0;
    this.lines.update(items => items.map(item =>
      item.productId === line.productId && item.variantId === line.variantId
        ? { ...item, quantity: parsed }
        : item
    ));
  }

  removeProduct(line: OrderDraftLine): void {
    this.lines.update(items => items.filter(item =>
      !(item.productId === line.productId && item.variantId === line.variantId)));
  }

  togglePayment(method: 'COD' | 'ONLINE_MOCK'): void {
    this.paymentMethod.set(method);
  }

  explainVoucher(): void {
    this.toast.show('Chưa thể áp dụng mã khi tạo đơn hộ khách. Chức năng sẽ khả dụng sau khi kết nối tính giá từ hệ thống.', 'info');
  }

  explainSave(): void {
    this.toast.show('Chưa thể lưu đơn hàng. Hệ thống đang chờ chức năng tạo đơn hộ khách.', 'info');
  }

  readonly missingShippingAddress = computed(() => !this.shippingLine1().trim() || !this.shippingCity().trim());
  readonly showAddressContractWarning = computed(() => this.selectedCustomer() !== null);
}
