import { ChangeDetectionStrategy, Component, OnChanges, Input, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { BranchManagementApiService } from '../services/branch-management-api.service';
import { AdminStaffWeekNavComponent } from '../../staff/components/admin-staff-week-nav.component';

/** Backend provides per-service slots. Totals are service-slot counts, NOT independent staffing capacity. */
interface SlotRow { label: string; booked: number; total: number; remaining: number; status: string; }
interface SlotServiceRow { time: string; name: string; booked: number; total: number; remaining: number; status: string; }
@Component({
  selector: 'app-branch-hours-preview',
  standalone: true,
  imports: [AdminStaffWeekNavComponent],
  template: `
    <section class="branch-v2" aria-labelledby="branch-hours-heading">
      <div class="branch-v2__heading">
        <h2 id="branch-hours-heading">Lịch hoạt động</h2>
        <app-admin-staff-week-nav
          [monday]="weekDays()[0].iso"
          [label]="weekLabel()"
          (previousWeek)="moveWeek(-1)"
          (nextWeek)="moveWeek(1)"
          (currentWeek)="goToday()"
          (dateSelected)="chooseDate($event)">
        </app-admin-staff-week-nav>
      </div>

      <div class="branch-v2__days" aria-label="Các ngày trong tuần">
        @for (day of weekDays(); track day.iso) {
          <button type="button" [class.branch-v2__day--active]="selectedDate() === day.iso"
            [attr.aria-pressed]="selectedDate() === day.iso" (click)="chooseDate(day.iso)">
            <span>{{ day.weekday }}</span><strong>{{ day.dayMonth }}</strong>
            <small>{{ selectedDate() === day.iso ? dailyTotal() : '—' }}</small>
          </button>
        }
      </div>

      

      @if (loading()) { <p role="status">Đang tải các khung giờ...</p> }
      @if (error()) { <p role="alert">{{ error() }} <button type="button" (click)="load()">Thử lại</button></p> }
      @if (!loading() && !error() && !timeRows().length) {
        <p role="status">Không có lịch khả dụng trong ngày đã chọn.</p>
      }
      <p class="branch-v2__preview-note">Số liệu cộng theo lượt đặt của từng dịch vụ, không phải tổng nhân sự độc lập tại chi nhánh.</p>
      <div class="branch-v2__table-scroll">
        <table class="branch-v2__monitor">
          <thead><tr>
            <th scope="col">Khung giờ</th><th scope="col">Trạng thái</th>
            <th scope="col">Đặt / Tổng</th><th scope="col">Còn trống</th><th scope="col">Lấp đầy</th><th scope="col">Thao tác</th>
          </tr></thead>
          <tbody>
            @for (slot of timeRows(); track slot.label) {
              <tr>
                <td>{{ slot.label }}</td>
                <td><span class="branch-v2__status"
                  [class.branch-v2__status--locked]="slot.status === 'BLOCKED'"
                  [class.branch-v2__status--full]="slot.status === 'FULL'"
                  [class.branch-v2__status--near]="slot.status === 'NEARLY_FULL'">
                  {{ slotStatus(slot) }}
                </span></td>
                <td>{{ slot.booked + ' / ' + slot.total }}</td>
                <td>{{ slot.remaining }}</td>
                <td>
                  <div class="branch-v2__fill">
                    <span>{{ slotPercent(slot) + '%' }}</span>
                    <div class="branch-v2__progress"><i [style.width.%]="slotPercent(slot)"
                      [class.branch-v2__progress--near]="slotPercent(slot) >= 80 && slotPercent(slot) < 100"
                      [class.branch-v2__progress--full]="slotPercent(slot) >= 100"></i></div>
                  </div>
                </td>
                <td><button type="button" class="branch-v2__eye"
                  (click)="showSlotInfo(slot)" [attr.aria-label]="'Xem khung giờ ' + slot.label" title="Xem chi tiết"><img src="/assets/admin-branch/figma-eye.svg" width="20" height="20" alt="" /></button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (selectedSlot(); as slot) {
        <div class="branch-v2__overlay" role="presentation" (click)="closeSlot()">
          <section class="branch-v2__modal branch-v2__slot-modal" role="dialog" aria-modal="true" aria-labelledby="branch-slot-modal"
            (click)="$event.stopPropagation()">
            <header class="branch-v2__modal-header">
              <div><h2 id="branch-slot-modal">Chi tiết khung giờ</h2>
                <p>{{ displayDate() }} · {{ slot.label }}</p>
              </div>
              <button type="button" aria-label="Đóng" (click)="closeSlot()">×</button>
            </header>
            <div class="branch-v2__slot-stats">
              <div><span>Trạng thái</span><strong>{{ slotStatus(slot) }}</strong></div>
              <div><span>Đã đặt / Tổng</span><strong>{{ isFigmaDay() ? slot.booked + ' / ' + slot.total : '—' }}</strong></div>
              <div><span>Còn trống</span><strong>{{ isFigmaDay() ? slot.total - slot.booked : '—' }}</strong></div>
              <div><span>Lấp đầy</span><strong>{{ isFigmaDay() ? slotPercent(slot) + '%' : '—' }}</strong></div>
            </div>
            <h3>Dịch vụ trong khung giờ</h3>
            <table class="branch-v2__modal-table">
              <thead><tr><th>Dịch vụ</th><th>Đã đặt / Tổng</th><th>Còn trống</th><th>Trạng thái</th></tr></thead>
              <tbody>
                @for (item of slotDetails(slot); track item.name) {
                  <tr><td>{{ item.name }}</td><td>{{ item.booked }} / {{ item.total }}</td>
                    <td>{{ item.remaining }}</td><td>{{ statusOf(item.status) }}</td></tr>
                } @empty {
                  <tr><td colspan="4">Không có dữ liệu dịch vụ cho khung giờ này.</td></tr>
                }
              </tbody>
            </table>
            @if (actionNotice()) { <p class="branch-v2__preview-note" role="status">{{ actionNotice() }}</p> }
            <footer class="branch-v2__modal-footer">
              <button type="button" class="branch-v2__modal-close" (click)="closeSlot()">Đóng</button>
              <button type="button" class="branch-v2__modal-lock" (click)="showLockUnavailable()">Tạm khóa theo dịch vụ</button>
            </footer>
          </section>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchHoursPreviewComponent implements OnChanges {
  private readonly toast = inject(AdminToastService);
  private readonly api = inject(BranchManagementApiService);
  private readonly destroyRef = inject(DestroyRef);
  @Input({ required: true }) branchId = '';
  @Input() serviceNames: Readonly<Record<string, string>> = {};
  readonly loading = signal(false);
  readonly error = signal('');
  readonly selectedDate = signal(this.toLocalIso(new Date()));
  readonly selectedSlot = signal<SlotRow | null>(null);
  readonly actionNotice = signal('');
  readonly timeRows = signal<readonly SlotRow[]>([]);
  readonly byTime = signal<Readonly<Record<string, SlotServiceRow[]>>>({});
  readonly dailyTotal = computed(() => this.timeRows().reduce((n, row) => n + row.booked, 0) + ' lượt');
  private request = 0;

  ngOnChanges(): void { this.load(); }

  load(): void {
    if (!this.branchId) return;
    const request = ++this.request;
    this.loading.set(true); this.error.set(''); this.timeRows.set([]);
    this.byTime.set({});
    this.api.getOperationSlots(this.branchId, this.selectedDate()).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: result => {
        if (request !== this.request) return;
        const slots = new Map<string, SlotRow>();
        const byTime = new Map<string, SlotServiceRow[]>();
        for (const service of result.servicesAvailability ?? []) {
          const serviceId = service.serviceIds?.[0] ?? '';
          const name = this.serviceNames[serviceId] || 'Dịch vụ';
          for (const segment of service.slots ?? []) {
            const clock = segment.start.slice(11, 16);
            const end = segment.end.slice(11, 16);
            const label = clock + '–' + end;
            const booked = segment.bookedCount ?? 0;
            const total = segment.totalCount ?? 0;
            const remaining = segment.remaining ?? 0;
            const current = slots.get(label) ?? { label, booked: 0, total: 0, remaining: 0, status: 'AVAILABLE' };
            current.booked += booked;
            current.total += total;
            current.remaining += remaining;
            slots.set(label, current);
            const items = byTime.get(label) ?? [];
            items.push({ time: clock, name, booked, total, remaining, status: segment.status ?? 'AVAILABLE' });
            byTime.set(label, items);
          }
        }
        const values = [...slots.values()].sort((a,b) => a.label.localeCompare(b.label));
        for (const row of values) {
          const items = byTime.get(row.label) ?? [];
          row.status = items.some(x => x.status === 'BLOCKED') ? 'BLOCKED'
            : row.total > 0 && row.remaining === 0 ? 'FULL'
            : row.total > 0 && row.remaining / row.total <= .2 ? 'NEARLY_FULL' : 'AVAILABLE';
        }
        this.byTime.set(Object.fromEntries(byTime));
        this.timeRows.set(values);
        this.loading.set(false);
      },
      error: () => {
        if (request !== this.request) return;
        this.loading.set(false);
        this.error.set('Không tải được lịch hoạt động thực tế. Vui lòng thử lại.');
      },
    });
  }
  readonly weekDays = computed(() => {
    const selected = this.fromIso(this.selectedDate());
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - (selected.getDay() + 6) % 7);
    const labels = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','CN'];
    return labels.map((weekday,index) => {
      const d = new Date(monday); d.setDate(monday.getDate() + index);
      return { weekday, iso: this.toLocalIso(d),
        dayMonth: String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') };
    });
  });
  readonly weekLabel = computed(() => {
    const d = this.weekDays();
    return this.formatDate(d[0].iso) + ' – ' + this.formatDate(d[6].iso);
  });
  readonly displayDate = computed(() => this.fromIso(this.selectedDate()).toLocaleDateString('vi-VN'));
  private formatDate(iso: string): string {
    const [y,m,d] = iso.split('-'); return d + '/' + m + '/' + y;
  }
  private toLocalIso(value: Date): string {
    return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),
      String(value.getDate()).padStart(2,'0')].join('-');
  }
  private fromIso(iso: string): Date {
    const [year,month,day] = iso.split('-').map(Number);
    return new Date(year,month-1,day);
  }
  slotPercent(row: SlotRow): number {
    return row.total > 0 ? Math.round(row.booked * 100 / row.total) : 0;
  }
  statusOf(status: string): string {
    return status === 'BLOCKED' ? 'Tạm khóa' : status === 'FULL' ? 'Đầy'
      : status === 'NEARLY_FULL' ? 'Sắp đầy' : 'Còn chỗ';
  }
  slotStatus(row: SlotRow): string { return this.statusOf(row.status); }
  slotDetails(row: SlotRow): readonly SlotServiceRow[] { return this.byTime()[row.label] ?? []; }
  chooseDate(iso: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const date = this.fromIso(iso);
    if (Number.isFinite(date.getTime()) && this.toLocalIso(date) === iso) {
      this.selectedDate.set(iso); this.closeSlot(); this.load();
    }
  }
  moveWeek(steps: number): void {
    const d = this.fromIso(this.selectedDate()); d.setDate(d.getDate() + 7*steps);
    this.chooseDate(this.toLocalIso(d));
  }
  goToday(): void { this.chooseDate(this.toLocalIso(new Date())); }
  showSlotInfo(row: SlotRow): void { this.selectedSlot.set(row); this.actionNotice.set(''); }
  closeSlot(): void { this.selectedSlot.set(null); this.actionNotice.set(''); }
  showLockUnavailable(): void {
    this.toast.show('Để tạm khóa, hãy chọn dịch vụ trong tab Dịch vụ tại chi nhánh.', 'info');
  }
}
