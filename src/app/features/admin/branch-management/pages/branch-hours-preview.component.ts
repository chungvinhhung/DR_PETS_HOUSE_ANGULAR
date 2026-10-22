import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { AdminStaffWeekNavComponent } from '../../staff/components/admin-staff-week-nav.component';

/** Slot figures are copied from the Figma illustration, not computed Backend availability. */
interface SlotRow { label: string; booked: number; total: number; }
const FIGMA_SLOTS: readonly SlotRow[] = [
  { label:'07:00–08:00', booked:1, total:4 }, { label:'08:00–09:00', booked:2, total:5 },
  { label:'09:00–10:00', booked:4, total:5 }, { label:'10:00–11:00', booked:5, total:5 },
  { label:'11:00–12:00', booked:2, total:5 }, { label:'12:00–13:00', booked:0, total:0 },
  { label:'13:00–14:00', booked:4, total:5 }, { label:'14:00–15:00', booked:3, total:6 },
  { label:'15:00–16:00', booked:1, total:5 }, { label:'16:00–17:00', booked:5, total:5 },
  { label:'17:00–18:00', booked:3, total:5 }, { label:'18:00–19:00', booked:2, total:4 },
  { label:'19:00–20:00', booked:1, total:4 }, { label:'20:00–21:00', booked:1, total:4 },
];
const DAY_TOTALS = [28,35,41,34,46,52,31];

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
            <small>{{ isFigmaWeek() ? day.total + ' / 62' : '—' }}</small>
          </button>
        }
      </div>

      

      <div class="branch-v2__table-scroll">
        <table class="branch-v2__monitor">
          <thead><tr>
            <th scope="col">Khung giờ</th><th scope="col">Trạng thái</th>
            <th scope="col">Đặt / Tổng</th><th scope="col">Còn trống</th><th scope="col">Lấp đầy</th><th scope="col">Thao tác</th>
          </tr></thead>
          <tbody>
            @for (slot of timeRows; track slot.label) {
              <tr>
                <td>{{ slot.label }}</td>
                <td><span class="branch-v2__status"
                  [class.branch-v2__status--locked]="isFigmaDay() && slot.total === 0"
                  [class.branch-v2__status--full]="isFigmaDay() && slot.total > 0 && slot.booked === slot.total"
                  [class.branch-v2__status--near]="isFigmaDay() && slot.total > 0 && slot.booked / slot.total >= 0.8 && slot.booked < slot.total">
                  {{ isFigmaDay() ? slotStatus(slot) : 'Chưa có dữ liệu' }}
                </span></td>
                <td>{{ isFigmaDay() ? slot.booked + ' / ' + slot.total : '—' }}</td>
                <td>{{ isFigmaDay() ? slot.total - slot.booked : '—' }}</td>
                <td>
                  <div class="branch-v2__fill">
                    <span>{{ isFigmaDay() ? slotPercent(slot) + '%' : '—' }}</span>
                    <div class="branch-v2__progress"><i [style.width.%]="isFigmaDay() ? slotPercent(slot) : 0"
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
              <div><span>Trạng thái</span><strong>{{ isFigmaDay() ? slotStatus(slot) : '—' }}</strong></div>
              <div><span>Đã đặt / Tổng</span><strong>{{ isFigmaDay() ? slot.booked + ' / ' + slot.total : '—' }}</strong></div>
              <div><span>Còn trống</span><strong>{{ isFigmaDay() ? slot.total - slot.booked : '—' }}</strong></div>
              <div><span>Lấp đầy</span><strong>{{ isFigmaDay() ? slotPercent(slot) + '%' : '—' }}</strong></div>
            </div>
            <h3>Dịch vụ trong khung giờ</h3>
            <table class="branch-v2__modal-table">
              <thead><tr><th>Dịch vụ</th><th>Đã đặt / Tổng</th><th>Còn trống</th><th>Trạng thái</th></tr></thead>
              <tbody>
                @if (isFigmaDay() && slot.label === '09:00–10:00') {
                  <tr><td>Tắm &amp; Sấy khô</td><td>2 / 3</td><td>1</td><td>Còn chỗ</td></tr>
                  <tr><td>Khám tổng quát</td><td>2 / 2</td><td>0</td><td>Đầy</td></tr>
                } @else {
                  <tr><td colspan="4">Chưa có dữ liệu dịch vụ cho khung giờ này.</td></tr>
                }
              </tbody>
            </table>
            @if (actionNotice()) { <p class="branch-v2__preview-note" role="status">{{ actionNotice() }}</p> }
            <footer class="branch-v2__modal-footer">
              <button type="button" class="branch-v2__modal-close" (click)="closeSlot()">Đóng</button>
              <button type="button" class="branch-v2__modal-lock" (click)="showLockUnavailable()">♙ Khóa khung giờ</button>
            </footer>
          </section>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchHoursPreviewComponent {
  private readonly toast = inject(AdminToastService);
  readonly selectedDate = signal('2026-10-01'); // Figma preview day (not current live availability)
  readonly selectedSlot = signal<SlotRow | null>(null);
  readonly actionNotice = signal('');
  readonly timeRows = FIGMA_SLOTS;
  readonly weekDays = computed(() => {
    const selected = this.fromIso(this.selectedDate());
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - (selected.getDay() + 6) % 7);
    const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    return labels.map((weekday, index) => {
      const date = new Date(monday); date.setDate(monday.getDate() + index);
      return { weekday, iso: this.toLocalIso(date), dayMonth: String(date.getDate()).padStart(2,'0') + '/' + String(date.getMonth()+1).padStart(2,'0'), total: DAY_TOTALS[index] };
    });
  });
  readonly weekLabel = computed(() => {
    const days = this.weekDays();
    return this.formatDate(days[0].iso) + ' – ' + this.formatDate(days[6].iso);
  });
  readonly displayDate = computed(() => this.fromIso(this.selectedDate()).toLocaleDateString('vi-VN'));
  readonly isFigmaWeek = computed(() => this.weekDays()[0].iso === '2026-09-28');
  readonly isFigmaDay = computed(() => this.selectedDate() === '2026-10-01');

  private formatDate(iso: string): string {
    const [y,m,d] = iso.split('-'); return d + '/' + m + '/' + y;
  }
  private toLocalIso(value: Date): string {
    return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
  }
  private fromIso(iso: string): Date {
    const [year,month,day] = iso.split('-').map(Number);
    return new Date(year,month-1,day);
  }
  slotPercent(row: SlotRow): number { return row.total > 0 ? Math.round(row.booked * 100 / row.total) : 0; }
  slotStatus(row: SlotRow): string {
    if (row.total === 0) return 'Tạm khóa';
    if (row.booked >= row.total) return 'Đầy';
    if (this.slotPercent(row) >= 80) return 'Sắp đầy';
    return 'Còn chỗ';
  }
  chooseDate(iso: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const date = this.fromIso(iso);
    if (Number.isFinite(date.getTime()) && this.toLocalIso(date) === iso) this.selectedDate.set(iso);
  }
  moveWeek(steps: number): void {
    const day = this.fromIso(this.selectedDate());
    day.setDate(day.getDate() + 7 * steps);
    this.chooseDate(this.toLocalIso(day));
  }
  goToday(): void { this.chooseDate(this.toLocalIso(new Date())); }
  showSlotInfo(row: SlotRow): void { this.selectedSlot.set(row); this.actionNotice.set(''); }
  closeSlot(): void { this.selectedSlot.set(null); this.actionNotice.set(''); }
  showLockUnavailable(): void {
    this.toast.show('Chức năng khóa khung giờ hiện chưa khả dụng.', 'info');
  }
}
