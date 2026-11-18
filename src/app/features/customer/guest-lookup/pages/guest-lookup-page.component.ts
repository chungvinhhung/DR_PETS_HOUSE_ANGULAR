import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { DecisionModalService } from '../../../../core/customer/services/decision-modal.service';
import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { FooterComponent } from '../../../../layouts/customer/components/footer/footer.component';
import { CanvasLayoutComponent } from '../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLoadingComponent } from '../../../../shared/customer/components/customer-loading/customer-loading.component';
import { formatVnd } from '../../../../shared/customer/utils/currency';
import { FieldComponent } from '../../auth/components/field.component';
import { OtpFormComponent } from '../../auth/components/otp-form.component';
import { PrimaryButtonComponent } from '../../auth/components/primary-button.component';
import { GuestAppointmentDetailComponent } from '../components/guest-appointment-detail.component';
import { GuestOrderDetailComponent } from '../components/guest-order-detail.component';
import type { GuestOtpRequest, GuestTransaction, GuestTransactionList } from '../models/guest-lookup.models';
import { GuestLookupApiService } from '../services/guest-lookup-api.service';
import { GuestLookupSessionService } from '../services/guest-lookup-session.service';
import {
  APPOINTMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  formatDateTime,
  labelOf,
  maskContact,
  statusTone,
  toGuestOtpRequest,
} from '../utils/guest-lookup-display';
import { toGuestLookupError } from '../utils/guest-lookup-errors';

type LookupStep = 'contact' | 'otp' | 'list' | 'detail';
type TransactionFilter = 'all' | 'order' | 'appointment';

interface ActiveChallenge {
  challengeId: string;
  expiresAt: number;
  request: GuestOtpRequest;
  /** true khi BE đã hủy challenge (nhập sai quá số lần) -> bắt buộc gửi mã mới. */
  locked: boolean;
}

/**
 * GuestLookupPage — Tra cứu đơn hàng / lịch hẹn cho khách chưa có tài khoản (M02).
 *
 * Luồng: nhập SĐT/email -> gửi OTP -> xác minh OTP -> danh sách giao dịch -> chi tiết.
 * Chi tiết được dựng từ chính dữ liệu GET /guest/transactions (đã được BE giới hạn theo contact đã xác minh),
 * không gọi /orders/:id hay /appointments/:id theo ID -> không thể đổi ID để xem giao dịch của người khác.
 */
@Component({
  selector: 'div[app-guest-lookup-page]',
  standalone: true,
  imports: [
    CanvasLayoutComponent,
    NavBarComponent,
    FooterComponent,
    CustomerIconComponent,
    CustomerLoadingComponent,
    FieldComponent,
    OtpFormComponent,
    PrimaryButtonComponent,
    GuestOrderDetailComponent,
    GuestAppointmentDetailComponent,
  ],
  templateUrl: './guest-lookup-page.component.html',
  styleUrl: './guest-lookup-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestLookupPageComponent implements OnInit {
  private readonly api = inject(GuestLookupApiService);
  private readonly decisionModal = inject(DecisionModalService);
  private readonly navService = inject(CustomerNavigationService);
  protected readonly session = inject(GuestLookupSessionService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly ORDER_STATUS_LABELS = ORDER_STATUS_LABELS;
  protected readonly APPOINTMENT_STATUS_LABELS = APPOINTMENT_STATUS_LABELS;
  protected readonly SERVICE_TYPE_LABELS = SERVICE_TYPE_LABELS;
  protected readonly labelOf = labelOf;
  protected readonly statusTone = statusTone;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatVnd = formatVnd;
  protected readonly goBackFromOtp = () => this.backToContact();

  // --- Trạng thái ---
  protected readonly step = signal<LookupStep>('contact');
  protected readonly now = signal(Date.now());
  protected readonly notice = signal('');

  protected readonly contactValue = signal('');
  protected readonly contactError = signal('');
  protected readonly requesting = signal(false);

  protected readonly challenge = signal<ActiveChallenge | null>(null);
  protected readonly otpError = signal('');
  protected readonly otpInfo = signal('');
  protected readonly verifying = signal(false);
  protected readonly resendCooldownUntil = signal(0);
  /** Chỉ có khi BE chạy môi trường dev (controlled mock) và FE build không phải production. */
  protected readonly debugOtp = signal('');

  protected readonly transactions = signal<GuestTransactionList | null>(null);
  protected readonly listLoading = signal(false);
  protected readonly listError = signal('');
  protected readonly filter = signal<TransactionFilter>('all');
  protected readonly selected = signal<GuestTransaction | null>(null);
  protected readonly branchNames = signal<Record<string, string>>({});

  // --- Giá trị tính toán ---
  protected readonly maskedContact = computed(() => {
    const request = this.challenge()?.request;
    return request ? maskContact(request) : this.session.maskedContact();
  });

  protected readonly guestPhone = computed(() => {
    const req = this.challenge()?.request;
    return req && 'phone' in req ? req.phone : (!this.contactValue().includes('@') ? this.contactValue() : '');
  });

  protected readonly guestEmail = computed(() => {
    const req = this.challenge()?.request;
    return req && 'email' in req ? req.email : (this.contactValue().includes('@') ? this.contactValue() : '');
  });

  protected readonly otpSecondsLeft = computed(() => {
    const challenge = this.challenge();
    return challenge ? Math.max(0, Math.ceil((challenge.expiresAt - this.now()) / 1000)) : 0;
  });

  protected readonly otpExpired = computed(() => Boolean(this.challenge()) && this.otpSecondsLeft() === 0);

  protected readonly resendSecondsLeft = computed(() =>
    Math.max(0, Math.ceil((this.resendCooldownUntil() - this.now()) / 1000)),
  );

  protected readonly resendLabel = computed(() => {
    if (this.requesting()) return 'Đang gửi...';
    const seconds = this.resendSecondsLeft();
    return seconds > 0 ? `Gửi lại mã (${seconds}s)` : 'Gửi lại mã';
  });

  protected readonly allTransactions = computed<GuestTransaction[]>(() => {
    const data = this.transactions();
    if (!data) return [];
    const items: GuestTransaction[] = [
      ...data.orders.map((order) => ({ kind: 'order' as const, id: order._id, data: order })),
      ...data.appointments.map((appointment) => ({ kind: 'appointment' as const, id: appointment._id, data: appointment })),
    ];
    return items.sort((a, b) => toTime(b.data.createdAt) - toTime(a.data.createdAt));
  });

  protected readonly visibleTransactions = computed(() => {
    const filter = this.filter();
    return filter === 'all' ? this.allTransactions() : this.allTransactions().filter((item) => item.kind === filter);
  });

  protected readonly filterTabs = computed(() => {
    const data = this.transactions();
    return [
      { value: 'all' as const, label: 'Tất cả', count: this.allTransactions().length },
      { value: 'order' as const, label: 'Đơn hàng', count: data?.orders.length ?? 0 },
      { value: 'appointment' as const, label: 'Lịch hẹn', count: data?.appointments.length ?? 0 },
    ];
  });

  protected readonly showDebugOtp = !environment.production;

  ngOnInit(): void {
    const timer = setInterval(() => this.tick(), 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    // Quay lại trang trong cùng phiên SPA: token còn hạn thì vào thẳng danh sách.
    if (this.session.token()) {
      this.step.set('list');
      void this.loadTransactions();
    }
  }

  // --- Bước A: nhập contact ---
  protected handleContactInput(event: Event) {
    this.contactValue.set((event.target as HTMLInputElement).value);
    this.contactError.set('');
  }

  protected async submitContact(event: Event) {
    event.preventDefault();
    if (this.requesting()) return;

    this.notice.set('');
    if (!this.contactValue().trim()) {
      this.contactError.set('Vui lòng nhập số điện thoại hoặc email.');
      return;
    }
    const request = toGuestOtpRequest(this.contactValue());
    if (!request) {
      this.contactError.set('Vui lòng nhập số điện thoại 10 số (bắt đầu bằng 0) hoặc email hợp lệ.');
      return;
    }

    const sent = await this.sendOtp(request, (message) => this.contactError.set(message));
    if (sent) this.step.set('otp');
  }

  // --- Bước B: OTP ---
  protected async resendOtp() {
    const challenge = this.challenge();
    if (!challenge || this.requesting() || this.resendSecondsLeft() > 0) return;
    this.otpError.set('');
    this.otpInfo.set('');
    const sent = await this.sendOtp(challenge.request, (message) => this.otpError.set(message));
    if (sent) this.otpInfo.set(`Đã gửi mã mới tới ${maskContact(challenge.request)}.`);
  }

  protected async verifyOtp(otp: string) {
    const challenge = this.challenge();
    if (!challenge || this.verifying()) return;

    this.otpInfo.set('');
    if (challenge.locked) {
      this.otpError.set('Mã này không còn hiệu lực. Vui lòng bấm "Gửi lại mã" để nhận mã mới.');
      return;
    }
    if (this.otpExpired()) {
      this.otpError.set('Mã OTP đã hết hạn. Vui lòng bấm "Gửi lại mã" để nhận mã mới.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      this.otpError.set('Vui lòng nhập đủ 6 chữ số.');
      return;
    }

    this.verifying.set(true);
    this.otpError.set('');
    try {
      const result = await this.api.verifyOtp(challenge.challengeId, otp);
      this.session.start(result.lookupToken, result.expiresIn, maskContact(challenge.request));
      this.challenge.set(null);
      this.debugOtp.set('');
      this.step.set('list');
      void this.loadTransactions({ announceEmpty: true });
    } catch (error) {
      const mapped = toGuestLookupError(error, 'verify-otp');
      if (mapped.kind === 'too-many-attempts') {
        this.challenge.set({ ...challenge, locked: true });
      }
      this.otpError.set(
        mapped.kind === 'invalid-otp' && this.otpExpired()
          ? 'Mã OTP đã hết hạn. Vui lòng bấm "Gửi lại mã" để nhận mã mới.'
          : mapped.message,
      );
    } finally {
      this.verifying.set(false);
    }
  }

  protected backToContact() {
    this.otpError.set('');
    this.otpInfo.set('');
    this.step.set('contact');
  }

  // --- Bước C/D: danh sách & chi tiết ---
  /** announceEmpty: bật popup khi danh sách rỗng — chỉ dùng ngay sau khi xác minh OTP, không lặp lại khi bấm "Làm mới". */
  protected async loadTransactions({ announceEmpty = false } = {}) {
    const token = this.session.token();
    if (!token) {
      this.expireSession();
      return;
    }

    this.listLoading.set(true);
    this.listError.set('');
    try {
      const data = await this.api.getTransactions(token);
      this.transactions.set(data);
      if (data.appointments.length) void this.loadBranchNames();
      if (announceEmpty && !data.orders.length && !data.appointments.length) this.showNotFoundModal();
    } catch (error) {
      const mapped = toGuestLookupError(error, 'transactions');
      if (mapped.kind === 'session-expired') {
        this.expireSession(mapped.message);
        return;
      }
      this.listError.set(mapped.message);
    } finally {
      this.listLoading.set(false);
    }
  }

  protected openDetail(item: GuestTransaction) {
    if (!this.session.token()) {
      this.expireSession();
      return;
    }
    this.selected.set(item);
    this.step.set('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected backToList() {
    this.selected.set(null);
    this.step.set('list');
  }

  /** Kết thúc phiên tra cứu và quay về bước nhập contact. */
  protected restart() {
    this.session.clear();
    this.resetLookupState();
    this.contactValue.set('');
    this.notice.set('');
    this.step.set('contact');
  }

  protected orderTitle(item: GuestTransaction): string {
    if (item.kind !== 'order') return '';
    const items = item.data.items ?? [];
    const first = items[0]?.nameSnapshot || 'Sản phẩm';
    return items.length > 1 ? `${first} và ${items.length - 1} sản phẩm khác` : first;
  }

  protected appointmentTitle(item: GuestTransaction): string {
    if (item.kind !== 'appointment') return '';
    const names = (item.data.services ?? []).map((service) => service.serviceName).filter(Boolean);
    return names.join(', ') || labelOf(SERVICE_TYPE_LABELS, item.data.serviceType);
  }

  // --- Nội bộ ---
  private async sendOtp(request: GuestOtpRequest, onError: (message: string) => void): Promise<boolean> {
    this.requesting.set(true);
    try {
      const result = await this.api.requestOtp(request);
      this.challenge.set({
        challengeId: result.challengeId,
        expiresAt: Date.now() + result.expiresIn * 1000,
        request,
        locked: false,
      });
      this.debugOtp.set(this.showDebugOtp ? result.debugOtp ?? '' : '');
      this.otpError.set('');
      // BE không trả thời gian cooldown khi gửi thành công; chỉ biết khi gặp 429 lúc gửi lại.
      this.resendCooldownUntil.set(0);
      return true;
    } catch (error) {
      const mapped = toGuestLookupError(error, 'request-otp');
      if (mapped.kind === 'rate-limited' && mapped.retryAfterSeconds) {
        this.resendCooldownUntil.set(Date.now() + mapped.retryAfterSeconds * 1000);
      }
      // Đang cooldown nhưng mã vừa gửi cho đúng contact này vẫn còn hạn -> cho nhập tiếp mã đó.
      const current = this.challenge();
      if (
        mapped.kind === 'rate-limited' &&
        this.step() === 'contact' &&
        current &&
        !current.locked &&
        current.expiresAt > Date.now() &&
        JSON.stringify(current.request) === JSON.stringify(request)
      ) {
        this.otpInfo.set('Mã OTP đã được gửi trước đó và vẫn còn hiệu lực.');
        this.step.set('otp');
        return false;
      }
      onError(mapped.message);
      return false;
    } finally {
      this.requesting.set(false);
    }
  }

  /**
   * BE không phân biệt "SĐT/email chưa từng giao dịch" với "không còn giao dịch" (cả hai đều trả mảng rỗng),
   * nên popup chỉ nói chưa tìm thấy giao dịch, không khẳng định SĐT có/không tồn tại trong hệ thống.
   */
  private showNotFoundModal() {
    this.decisionModal.showNotice({
      title: 'KHÔNG TÌM THẤY',
      message: `Chưa có đơn hàng hoặc lịch hẹn nào gắn với ${this.maskedContact()}.\nVui lòng kiểm tra lại số điện thoại/email đã dùng khi đặt.`,
      cancelLabel: 'Quay về Trang chủ',
      confirmLabel: 'Tra cứu lại',
      onCancel: () => {
        this.restart();
        this.navService.navigate('/');
      },
      onConfirm: () => this.restart(),
    });
  }

  private async loadBranchNames() {
    if (Object.keys(this.branchNames()).length) return;
    try {
      this.branchNames.set(await this.api.getBranchNames());
    } catch {
      // Tên chi nhánh chỉ là thông tin phụ — lỗi thì bỏ qua, không chặn tra cứu.
    }
  }

  private tick() {
    this.now.set(Date.now());
    const step = this.step();
    if ((step === 'list' || step === 'detail') && !this.session.token()) {
      this.expireSession();
    }
  }

  private expireSession(message = 'Phiên tra cứu đã hết hạn. Vui lòng xác minh lại bằng mã OTP.') {
    this.session.clear();
    this.resetLookupState();
    this.notice.set(message);
    this.step.set('contact');
  }

  private resetLookupState() {
    this.challenge.set(null);
    this.debugOtp.set('');
    this.otpError.set('');
    this.otpInfo.set('');
    this.transactions.set(null);
    this.listError.set('');
    this.selected.set(null);
    this.filter.set('all');
  }
}

function toTime(value: unknown): number {
  const time = value ? new Date(String(value)).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}
