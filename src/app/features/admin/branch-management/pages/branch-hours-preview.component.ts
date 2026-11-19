import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminStaffWeekNavComponent } from '../../staff/components/admin-staff-week-nav.component';
import { CatalogService } from '../../service-catalog/models/service-catalog.model';
import {
  BranchManagementApiService,
  BranchOperationSlotsResponse,
  ServiceAvailabilityResponse,
  ServiceAvailabilitySlot,
} from '../services/branch-management-api.service';

interface SlotRow {
  key: string;
  label: string;
  start: string;
  end: string;
  booked: number;
  total: number;
  remaining: number;
  status: 'AVAILABLE' | 'FULL' | 'BLOCKED' | 'UNAVAILABLE';
}

@Component({
  selector: 'app-branch-hours-preview',
  standalone: true,
  imports: [AdminStaffWeekNavComponent, AdminDataStateComponent],
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
            <small>{{ selectedDate() === day.iso && !loading() && !error() ? daySummary() : '—' }}</small>
          </button>
        }
      </div>

      @if (loading()) {
        <app-admin-data-state kind="loading" title="Đang tải lịch hoạt động" />
      } @else if (error()) {
        <app-admin-data-state kind="error" title="Không thể tải lịch hoạt động" [message]="error()" (retry)="load()" />
      } @else {
        <div class="branch-v2__table-scroll">
          <table class="branch-v2__monitor">
            <thead><tr>
              <th scope="col">Khung giờ</th><th scope="col">Trạng thái</th>
              <th scope="col">Đặt / Tổng</th><th scope="col" title="Số chỗ có thể đặt thực tế, sau khi tính lịch nhân viên và điều kiện dịch vụ">Còn trống</th><th scope="col" title="Tỷ lệ lịch đã đặt trên công suất cấu hình">Lấp đầy</th><th scope="col">Thao tác</th>
            </tr></thead>
            <tbody>
              @for (slot of timeRows(); track slot.key) {
                <tr>
                  <td>{{ slot.label }}</td>
                  <td><span class="branch-v2__status"
                    [class.branch-v2__status--locked]="slot.status === 'BLOCKED'"
                    [class.branch-v2__status--full]="slot.status === 'FULL'"
                    [class.branch-v2__status--unavailable]="slot.status === 'UNAVAILABLE'"
                    [title]="slotStatusHint(slot)"
                    [class.branch-v2__status--near]="slot.status === 'AVAILABLE' && slotPercent(slot) >= 80">
                    {{ slotStatus(slot) }}
                  </span></td>
                  <td>{{ slot.booked }} / {{ slot.total }}</td>
                  <td>{{ slot.remaining }}</td>
                  <td>
                    <div class="branch-v2__fill">
                      <span>{{ slotPercent(slot) }}%</span>
                      <div class="branch-v2__progress"><i [style.width.%]="slotPercent(slot)"
                        [class.branch-v2__progress--near]="slotPercent(slot) >= 80 && slotPercent(slot) < 100"
                        [class.branch-v2__progress--full]="slotPercent(slot) >= 100"></i></div>
                    </div>
                  </td>
                  <td><button type="button" class="branch-v2__eye"
                    (click)="showSlotInfo(slot)" [attr.aria-label]="'Xem khung giờ ' + slot.label" title="Xem chi tiết">
                    <img src="/assets/admin-branch/figma-eye.svg" width="20" height="20" alt="" />
                  </button></td>
                </tr>
              } @empty {
                <tr><td colspan="6"><app-admin-data-state kind="empty" title="Chưa có khung giờ hoạt động" message="Không có dịch vụ khả dụng trong ngày đã chọn." /></td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (selectedSlot(); as slot) {
        <div class="branch-v2__overlay" role="presentation" (click)="closeSlot()">
          <section class="branch-v2__modal branch-v2__slot-modal" role="dialog" aria-modal="true"
            aria-labelledby="branch-slot-modal" (click)="$event.stopPropagation()">
            <header class="branch-v2__modal-header">
              <div><h2 id="branch-slot-modal">Chi tiết khung giờ</h2>
                <p>{{ displayDate() }} · {{ slot.label }}</p>
              </div>
              <button type="button" aria-label="Đóng" (click)="closeSlot()">×</button>
            </header>
            <div class="branch-v2__slot-stats">
              <div><span>Trạng thái</span><strong>{{ slotStatus(slot) }}</strong></div>
              <div><span>Đã đặt / Tổng</span><strong>{{ slot.booked }} / {{ slot.total }}</strong></div>
              <div><span>Còn trống</span><strong>{{ slot.remaining }}</strong></div>
              <div><span>Lấp đầy</span><strong>{{ slotPercent(slot) }}%</strong></div>
            </div>
            <h3>Dịch vụ trong khung giờ</h3>
            <table class="branch-v2__modal-table">
              <thead><tr><th>Dịch vụ</th><th>Đã đặt / Tổng</th><th>Còn trống</th><th>Trạng thái</th></tr></thead>
              <tbody>
                @for (row of selectedServiceRows(); track row.serviceId) {
                  <tr>
                    <td>{{ row.name }}</td>
                    <td>{{ row.booked }} / {{ row.total }}</td>
                    <td>{{ row.remaining }}</td>
                    <td>{{ row.status }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4">Chưa có dữ liệu dịch vụ cho khung giờ này.</td></tr>
                }
              </tbody>
            </table>
            <footer class="branch-v2__modal-footer">
              <button type="button" class="branch-v2__modal-close" (click)="closeSlot()">Đóng</button>
            </footer>
          </section>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchHoursPreviewComponent implements OnInit, OnChanges {
  private readonly api = inject(BranchManagementApiService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) branchId = '';
  @Input() services: readonly CatalogService[] = [];

  readonly selectedDate = signal(this.toLocalIso(new Date()));
  readonly selectedSlot = signal<SlotRow | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly response = signal<BranchOperationSlotsResponse | null>(null);

  readonly weekDays = computed(() => {
    const selected = this.fromIso(this.selectedDate());
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - (selected.getDay() + 6) % 7);
    const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    return labels.map((weekday, index) => {
      const date = new Date(monday); date.setDate(monday.getDate() + index);
      return {
        weekday,
        iso: this.toLocalIso(date),
        dayMonth: String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0'),
      };
    });
  });

  readonly weekLabel = computed(() => {
    const days = this.weekDays();
    return this.formatDate(days[0].iso) + ' – ' + this.formatDate(days[6].iso);
  });
  readonly displayDate = computed(() => this.fromIso(this.selectedDate()).toLocaleDateString('vi-VN'));

  readonly timeRows = computed<readonly SlotRow[]>(() => {
    const groups = new Map<string, SlotRow>();
    for (const availability of this.response()?.servicesAvailability ?? []) {
      for (const slot of availability.slots ?? []) {
        const key = slot.start;
        const existing = groups.get(key);
        const booked = Math.max(0, Number(slot.bookedCount) || 0);
        const total = Math.max(0, Number(slot.totalCount) || 0);
        const remaining = Math.max(0, Number(slot.remaining) || 0);
        const status = this.availabilityStatus(slot);
        if (!existing) {
          groups.set(key, {
            key,
            label: this.slotLabel(slot),
            start: slot.start,
            end: slot.end,
            booked,
            total,
            remaining,
            status,
          });
        } else {
          existing.booked += booked;
          existing.total += total;
          existing.remaining += remaining;
          existing.status = this.mergeStatuses(existing.status, status);
        }
      }
    }
    return [...groups.values()].sort((a, b) => a.start.localeCompare(b.start));
  });

  readonly daySummary = computed(() => {
    const rows = this.timeRows();
    const booked = rows.reduce((sum, row) => sum + row.booked, 0);
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return total ? booked + ' / ' + total : '—';
  });

  readonly selectedServiceRows = computed(() => {
    const selected = this.selectedSlot();
    if (!selected) return [];
    const names = new Map(this.services.map(service => [service.id, service.name]));
    return (this.response()?.servicesAvailability ?? []).flatMap(availability => {
      const slot = availability.slots?.find(candidate => candidate.start === selected.start);
      if (!slot) return [];
      const serviceId = availability.serviceIds?.[0] ?? '';
      const remaining = Math.max(0, Number(slot.remaining) || 0);
      return [{
        serviceId,
        name: names.get(serviceId) ?? 'Dịch vụ',
        booked: Math.max(0, Number(slot.bookedCount) || 0),
        total: Math.max(0, Number(slot.totalCount) || 0),
        remaining,
        status: this.statusText(this.availabilityStatus(slot)),
      }];
    });
  });

  ngOnInit(): void { this.load(); }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['branchId'] && !changes['branchId'].firstChange) this.load();
  }

  load(): void {
    if (!this.branchId) return;
    this.loading.set(true);
    this.error.set('');
    this.selectedSlot.set(null);
    this.api.getOperationSlots(this.branchId, this.selectedDate())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.response.set(response);
          this.loading.set(false);
        },
        error: () => {
          this.response.set(null);
          this.loading.set(false);
          this.error.set('Không thể tải lịch hoạt động. Vui lòng thử lại.');
        },
      });
  }

  /**
   * BE uses FULL both for occupied capacity and absence of a qualifying staff
   * shift. Only call the slot "Đầy" if bookings + active holds exhaust its capacity.
   */
  private availabilityStatus(slot: ServiceAvailabilitySlot): SlotRow['status'] {
    if (slot.status === 'BLOCKED') return 'BLOCKED';
    const remaining = Math.max(0, Number(slot.remaining) || 0);
    if (remaining > 0) return 'AVAILABLE';
    const total = Math.max(0, Number(slot.totalCount) || 0);
    const booked = Math.max(0, Number(slot.bookedCount) || 0);
    const held = Math.max(0, Number(slot.heldCount) || 0);
    return total > 0 && booked + held >= total ? 'FULL' : 'UNAVAILABLE';
  }

  private mergeStatuses(a: SlotRow['status'], b: SlotRow['status']): SlotRow['status'] {
    if (a === 'AVAILABLE' || b === 'AVAILABLE') return 'AVAILABLE';
    if (a === b) return a;
    return 'UNAVAILABLE';
  }

  private statusText(status: SlotRow['status']): string {
    switch (status) {
      case 'BLOCKED': return 'Tạm khóa';
      case 'FULL': return 'Đầy';
      case 'UNAVAILABLE': return 'Chưa khả dụng';
      default: return 'Còn chỗ';
    }
  }

  slotPercent(row: SlotRow): number {
    return row.total > 0 ? Math.min(100, Math.round(row.booked * 100 / row.total)) : 0;
  }

  slotStatus(row: SlotRow): string {
    if (row.status === 'AVAILABLE' && this.slotPercent(row) >= 80) return 'Sắp đầy';
    return this.statusText(row.status);
  }

  slotStatusHint(row: SlotRow): string {
    if (row.status === 'UNAVAILABLE') {
      return 'Khung giờ chưa nhận đặt lịch dù công suất chưa sử dụng hết. Có thể do ca nhân viên, giờ hoạt động hoặc điều kiện dịch vụ. BE chưa trả lý do chi tiết.';
    }
    if (row.status === 'FULL') return 'Công suất đã hết do lịch đặt và/hoặc lượt giữ chỗ.';
    if (row.status === 'BLOCKED') return 'Khung giờ bị khóa đặt lịch.';
    return 'Khung giờ hiện có thể nhận đặt lịch.';
  }
  chooseDate(iso: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const date = this.fromIso(iso);
    if (!Number.isFinite(date.getTime()) || this.toLocalIso(date) !== iso) return;
    this.selectedDate.set(iso);
    this.load();
  }
  moveWeek(steps: number): void {
    const day = this.fromIso(this.selectedDate());
    day.setDate(day.getDate() + 7 * steps);
    this.chooseDate(this.toLocalIso(day));
  }
  goToday(): void { this.chooseDate(this.toLocalIso(new Date())); }
  showSlotInfo(row: SlotRow): void { this.selectedSlot.set(row); }
  closeSlot(): void { this.selectedSlot.set(null); }

  private slotLabel(slot: ServiceAvailabilitySlot): string {
    return this.clock(slot.start) + '–' + this.clock(slot.end);
  }
  private clock(iso: string): string {
    return typeof iso === 'string' && iso.length >= 16 ? iso.slice(11, 16) : '—';
  }
  private formatDate(iso: string): string {
    const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y;
  }
  private toLocalIso(value: Date): string {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  }
  private fromIso(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}
