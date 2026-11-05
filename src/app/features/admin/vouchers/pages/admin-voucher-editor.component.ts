import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import {
  AdminVoucher, AdminVoucherApiService, VoucherDiscountType, VoucherScope,
  VoucherStatus, VoucherWriteBody, VOUCHER_SCOPE_LABELS,
  voucherAvailability, voucherDate, voucherMoney, voucherOffer,
} from '../services/admin-voucher-api.service';

interface VoucherFields {
  code: string;
  name: string;
  description: string;
  scope: VoucherScope;
  discountType: VoucherDiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  quota: string;
  status: VoucherStatus;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
}
const BLANK: VoucherFields = {
  code:'', name:'', description:'', scope:'ORDER', discountType:'PERCENTAGE', discountValue:'',
  minOrderAmount:'0', maxDiscountAmount:'', quota:'',
  status:'ACTIVE', fromDate:'', fromTime:'09:00', toDate:'', toTime:'23:59',
};

@Component({
  selector: 'app-admin-voucher-editor',
  standalone: true,
  imports: [AdminCatalogShellComponent, AdminBreadcrumbComponent, AdminDataStateComponent, RouterLink],
  templateUrl: './admin-voucher-editor.component.html',
  styleUrl: './admin-voucher-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminVoucherEditorComponent {
  private readonly api = inject(AdminVoucherApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = this.route.snapshot.data['mode'] as 'create' | 'edit' | 'view';
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly original = signal<AdminVoucher | null>(null);
  readonly form = signal<VoucherFields>({...BLANK});
  readonly loading = signal(this.mode !== 'create');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly validation = signal('');
  readonly dirty = signal(false);
  readonly maxDiscountUnlimited = signal(true);
  readonly leaveDialogOpen = signal(false);
  private leaveResolver: ((allow: boolean) => void) | null = null;
  readonly discountTypeLabels: Record<VoucherDiscountType,string> = {
    PERCENTAGE:'Theo phần trăm', FIXED:'Tiền cố định',
  };
  readonly scopeLabels = VOUCHER_SCOPE_LABELS;
  readonly canWrite = computed(() => this.session.user()?.systemRole === 'ADMIN');
  readonly allowEditing = computed(() => this.mode !== 'view' && this.canWrite());
  readonly used = computed(() => this.original()?.usedCount ?? 0);
  readonly isEnabled = computed(() => this.original()?.status === 'ACTIVE');
  readonly now = signal(Date.now());
  readonly voucherStart = computed(() => this.mode === 'view'
    ? Date.parse(this.original()?.effectiveFrom ?? '')
    : Date.parse(this.iso(this.form().fromDate, this.form().fromTime) ?? ''));
  readonly voucherEnd = computed(() => this.mode === 'view'
    ? Date.parse(this.original()?.effectiveTo ?? '')
    : Date.parse(this.iso(this.form().toDate, this.form().toTime) ?? ''));
  // No date selected yet: show the default scheduling choice, not an active status.
  readonly endTimePassed = computed(() => Number.isFinite(this.voucherEnd()) && this.now() >= this.voucherEnd());
  readonly beforeStart = computed(() =>
    !Number.isFinite(this.voucherStart()) || this.now() < this.voucherStart());
  readonly showActivation = computed(() =>
    Number.isFinite(this.voucherStart()) &&
    (!Number.isFinite(this.voucherEnd()) || this.now() < this.voucherEnd()));
  readonly activationEnabled = computed(() =>
    this.mode === 'view' ? this.original()?.status === 'ACTIVE' : this.form().status === 'ACTIVE');
  readonly activationLabel = computed(() => this.beforeStart()
    ? this.activationEnabled() ? 'Tự động kích hoạt theo lịch' : 'Kích hoạt thủ công'
    : this.activationEnabled() ? 'Đang hoạt động' : 'Tạm ngừng');
  private nowInterval: ReturnType<typeof setInterval> | null = null;
  readonly remaining = computed(() => {
    const v = this.original();
    return v ? Math.max(0, v.quota - v.usedCount) : 0;
  });
  readonly percentage = computed(() => {
    const v = this.original();
    return v && v.quota ? Math.round(v.usedCount / v.quota * 100) : 0;
  });

  private readonly createKey = 'voucher-create-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);

  constructor() {
    this.nowInterval = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => {
      if (this.nowInterval) clearInterval(this.nowInterval);
    });
    if (this.mode !== 'create') this.load();
  }
  private fmtDate(iso: string): string {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return '';
    return new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
  }
  private fmtTime(iso: string): string {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return '';
    return new Date(ms + 7 * 3600000).toISOString().slice(11, 16);
  }
  private load(): void {
    this.loading.set(true);this.error.set('');
    this.api.get(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: v => {
        this.original.set(v);
        this.form.set({
          code:v.code, name:v.name, description:v.description ?? '', scope:v.scope, discountType:v.discountType,
          discountValue:String(v.discountValue),
          minOrderAmount:v.minOrderAmount == null ? '' : String(v.minOrderAmount),
          maxDiscountAmount:v.maxDiscountAmount == null ? '' : String(v.maxDiscountAmount),
          quota:String(v.quota), status:v.status,
          fromDate:this.fmtDate(v.effectiveFrom), fromTime:this.fmtTime(v.effectiveFrom),
          toDate:this.fmtDate(v.effectiveTo), toTime:this.fmtTime(v.effectiveTo),
        });
        this.maxDiscountUnlimited.set(v.maxDiscountAmount == null);
        this.dirty.set(false);
        this.loading.set(false);
      },
      error: err => {this.loading.set(false);this.error.set(adminErrorMessage(err,'Không tải được voucher.'));},
    });
  }
  retry(): void {if (this.mode !== 'create') this.load();}
  changeActivation(enabled: boolean): void {
    if (!this.allowEditing() || this.saving()) return;
    // ACTIVE is only eligible inside effectiveFrom/effectiveTo; INACTIVE
    // remains disabled even once the start time arrives.
    this.change('status', enabled ? 'ACTIVE' : 'INACTIVE');
  }
  toggleActivationFromView(input: HTMLInputElement): void {
    const v = this.original();
    if (!v || this.mode !== 'view' || !this.canWrite() || this.saving() ||
        !this.showActivation()) {
      input.checked = this.activationEnabled() ?? false;
      return;
    }
    const status: VoucherStatus = input.checked ? 'ACTIVE' : 'INACTIVE';
    this.saving.set(true);
    this.api.update(v.id, {status})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: saved => {
          this.saving.set(false);
          if (saved.status !== status) {
            input.checked = v.status === 'ACTIVE';
            this.toast.show('BE chưa lưu đúng trạng thái voucher. Vui lòng tải lại.', 'error');
            this.load();
            return;
          }
          this.original.set(saved);
          this.toast.show(this.beforeStart()
            ? status === 'ACTIVE' ? 'Đã chọn tự động hoạt động theo lịch.' : 'Đã chọn kích hoạt thủ công.'
            : status === 'ACTIVE' ? 'Đã bật voucher.' : 'Đã tạm ngừng voucher.', 'success');
          this.load();
        },
        error: err => {
          input.checked = v.status === 'ACTIVE';
          this.saving.set(false);
          this.toast.show(adminErrorMessage(err, 'Không cập nhật được trạng thái voucher.'), 'error');
        },
      });
  }
  change<K extends keyof VoucherFields>(field: K, value: VoucherFields[K]): void {
    if (!this.allowEditing() || this.saving()) return;
    this.form.update(f => ({...f,[field]: value}));
    this.validation.set('');
    this.dirty.set(true);
  }
  toggleMaxDiscountUnlimited(checked: boolean): void {
    if (!this.allowEditing() || this.saving()) return;
    if (checked && this.mode === 'edit' && this.original()?.maxDiscountAmount != null) {
      const message = 'Backend chưa hỗ trợ xóa mức giảm tối đa đã lưu về trạng thái Không giới hạn.';
      this.validation.set(message);
      this.toast.show(message, 'info');
      return;
    }
    this.maxDiscountUnlimited.set(checked);
    if (checked) this.form.update(current => ({...current, maxDiscountAmount: ''}));
    this.validation.set('');
    this.dirty.set(true);
  }
  /** Angular CanDeactivate: covers Hủy, sidebar, breadcrumb and browser Back. */
  canLeavePage(): boolean | Promise<boolean> {
    if (this.saving()) return false;
    if (!this.dirty()) return true;
    // Only one pending navigation can own the confirmation dialog.
    if (this.leaveResolver) return false;
    this.leaveDialogOpen.set(true);
    return new Promise<boolean>(resolve => { this.leaveResolver = resolve; });
  }
  resolveLeave(allow: boolean): void {
    const resolve = this.leaveResolver;
    this.leaveResolver = null;
    this.leaveDialogOpen.set(false);
    resolve?.(allow);
  }
  @HostListener('document:keydown.escape')
  dismissDialogOnEscape(): void {
    if (this.leaveDialogOpen()) this.resolveLeave(false);
  }
  cancel(): void {void this.router.navigateByUrl('/admin/vouchers');}
  private iso(date: string, time: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    const t = new Date(date + 'T' + time + ':00+07:00');
    return Number.isNaN(t.getTime()) ? null : t.toISOString();
  }
  private payload(): VoucherWriteBody | null {
    const v = this.form();
    const from = this.iso(v.fromDate,v.fromTime);
    const to = this.iso(v.toDate,v.toTime);
    const num = Number(v.discountValue), quota = Number(v.quota);
    if (!/^[A-Z0-9_-]{3,40}$/.test(v.code.trim().toUpperCase())) {
      this.validation.set('Mã voucher cần 3–40 ký tự, chỉ gồm chữ không dấu, số, dấu gạch dưới hoặc gạch nối.'); return null;
    }
    if (!v.name.trim() || v.name.trim().length > 120) {
      this.validation.set('Vui lòng nhập tên chương trình (tối đa 120 ký tự).'); return null;
    }
    if (!Number.isFinite(num) || num <= 0 || (v.discountType === 'PERCENTAGE' && num > 100)) {
      this.validation.set('Giá trị giảm phải lớn hơn 0; giảm theo phần trăm không vượt quá 100%.'); return null;
    }
    if (!Number.isSafeInteger(quota) || quota < 1 || quota < this.used()) {
      this.validation.set('Giới hạn lượt phải là số nguyên từ 1 và không được thấp hơn số lượt đã sử dụng.');return null;
    }
    if (!from || !to || Date.parse(to) <= Date.parse(from)) {
      this.validation.set('Ngày giờ kết thúc phải sau ngày giờ bắt đầu.');return null;
    }
    const minimum = Number(v.minOrderAmount || '0');
    if (!Number.isFinite(minimum) || minimum < 0) {
      this.validation.set('Giá trị giao dịch tối thiểu phải là số không âm.');return null;
    }
    const body: VoucherWriteBody = {
      code:v.code.trim().toUpperCase(),name:v.name.trim(),description:v.description.trim(),
      scope:v.scope,discountType:v.discountType,discountValue:num,quota,
      status:v.status,effectiveFrom:from,effectiveTo:to,minOrderAmount:minimum,
    };
    if (v.discountType === 'PERCENTAGE' && !this.maxDiscountUnlimited()) {
      if (!v.maxDiscountAmount.trim()) {
        this.validation.set('Vui lòng nhập mức giảm tối đa hoặc chọn Không giới hạn mức giảm.');return null;
      }
      const max = Number(v.maxDiscountAmount);
      if (!Number.isFinite(max) || max <= 0) {
        this.validation.set('Giảm tối đa phải lớn hơn 0.');return null;
      }
      body.maxDiscountAmount=max;
    }
    return body;
  }
  save(): void {
    if (!this.allowEditing() || this.saving()) return;
    const body=this.payload();
    if (!body) {
      if (this.validation()) this.toast.show(this.validation(), 'error');
      return;
    }
    this.saving.set(true);
    const request=this.mode === 'create' ? this.api.create(body,this.createKey) : this.api.update(this.id,body);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => {
        this.saving.set(false);this.dirty.set(false);
        this.toast.show(this.mode === 'create' ? 'Tạo voucher thành công.' : 'Đã lưu thay đổi voucher.','success');
        this.router.navigate(['/admin/vouchers',value.id]);
      },
      error: err => {
        this.saving.set(false);
        this.toast.show(adminErrorMessage(err,'Không lưu được voucher. Vui lòng kiểm tra dữ liệu và thử lại.'),'error');
      },
    });
  }
  offer(v: AdminVoucher): string{return voucherOffer(v);}
  when(value?:string|null):string{return voucherDate(value);}
  money(value?:number|null):string{return voucherMoney(value);}
  availability(v:AdminVoucher):string{return voucherAvailability(v);}
}
