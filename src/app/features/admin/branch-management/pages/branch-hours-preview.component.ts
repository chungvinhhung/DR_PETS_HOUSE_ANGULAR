import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

interface SlotRow {
  label: string;
}

/**
 * Figma V2: Lịch hoạt động & sức chứa.
 * Presentation only until the BE exposes computed availability.
 * A displayed slot row is NOT a reservation slot and is not editable.
 */
@Component({
  selector: 'app-branch-hours-preview',
  standalone: true,
  template: `
    <section class="branch-management__panel branch-v2" aria-labelledby="branch-hours-heading">
      <div class="branch-v2__heading">
        <div>
          <h2 id="branch-hours-heading">Lịch hoạt động &amp; sức chứa</h2>
          <p>Theo dõi lịch hoạt động trong tuần và trạng thái các khung giờ tại chi nhánh.</p>
        </div>
        <div class="branch-v2__week-nav" aria-label="Điều hướng lịch">
          <button type="button" aria-label="Tuần trước" (click)="moveWeek(-1)">‹</button>
          <label class="branch-v2__date-control">
            <span class="branch-management__sr-only">Chọn ngày</span>
            <input #calendarDate type="date" [value]="selectedDate()" (change)="chooseDate(calendarDate.value)" />
          </label>
          <button type="button" (click)="goToday()">Hôm nay</button>
          <button type="button" aria-label="Tuần sau" (click)="moveWeek(1)">›</button>
        </div>
      </div>

      <div class="branch-v2__days" aria-label="Chọn ngày trong tuần">
        @for (day of weekDays(); track day.iso) {
          <button type="button" [class.branch-v2__day--active]="selectedDate() === day.iso"
            [attr.aria-pressed]="selectedDate() === day.iso" (click)="chooseDate(day.iso)">
            <span>{{ day.weekday }}</span><strong>{{ day.dayMonth }}</strong><small>—</small>
          </button>
        }
      </div>

      <div class="branch-v2__preview-note" role="status">
        Chưa kết nối API tính khả dụng. Số lịch đặt, sức chứa theo thời điểm và mức lấp đầy không có dữ liệu để hiển thị.
      </div>

      <div class="branch-management__table-scroll">
        <table class="branch-management__table branch-v2__slots">
          <thead>
            <tr><th scope="col">KHUNG GIỜ</th><th scope="col">TRẠNG THÁI</th><th scope="col">ĐẶT / TỔNG</th>
              <th scope="col">CÒN TRỐNG</th><th scope="col">LẤP ĐẦY</th><th scope="col">THAO TÁC</th></tr>
          </thead>
          <tbody>
            @for (slot of timeRows; track slot.label) {
              <tr>
                <td><strong>{{ slot.label }}</strong></td>
                <td><span class="branch-v2__muted-pill">Chưa có dữ liệu</span></td>
                <td>—</td><td>—</td>
                <td><div class="branch-v2__progress" aria-label="Chưa có dữ liệu lấp đầy"><span></span></div></td>
                <td><button class="branch-management__button branch-management__button--outline"
                  type="button" (click)="showSlotInfo(slot.label)" [attr.aria-label]="'Xem thông tin khung giờ ' + slot.label">Chi tiết</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (selectedSlot(); as slot) {
        <div class="branch-v2__overlay" (click)="closeSlot()" role="presentation">
          <section class="branch-v2__modal" role="dialog" aria-modal="true" aria-labelledby="branch-slot-modal"
            (click)="$event.stopPropagation()">
            <header class="branch-v2__modal-header">
              <div><h2 id="branch-slot-modal">Chi tiết khung giờ {{ slot }}</h2><p>{{ displayDate() }}</p></div>
              <button type="button" aria-label="Đóng" (click)="closeSlot()">×</button>
            </header>
            <p>Khả dụng phải được Backend tính từ giờ hoạt động, dịch vụ, capacity, nhân viên, ca làm, lịch đã đặt và các khoảng tạm khóa.</p>
            <p class="branch-v2__preview-note">Chưa có API để truy xuất chi tiết. Không hỗ trợ tự tạo slot hoặc ép trạng thái còn chỗ.</p>
            <footer class="branch-v2__modal-footer"><button class="branch-management__button branch-management__button--primary" type="button" (click)="closeSlot()">Đóng</button></footer>
          </section>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchHoursPreviewComponent {
  readonly selectedDate = signal(this.toLocalIso(new Date()));
  readonly selectedSlot = signal<string | null>(null);
  readonly timeRows: readonly SlotRow[] = Array.from({ length: 12 }, (_, index) => {
    const start = index + 7;
    return { label: `${String(start).padStart(2, '0')}:00 – ${String(start + 1).padStart(2, '0')}:00` };
  });
  readonly weekDays = computed(() => {
    const selected = this.fromIso(this.selectedDate());
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - (selected.getDay() + 6) % 7);
    const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    return labels.map((weekday, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { weekday, iso: this.toLocalIso(date), dayMonth: `${date.getDate()}/${date.getMonth() + 1}` };
    });
  });
  readonly displayDate = computed(() => this.fromIso(this.selectedDate()).toLocaleDateString('vi-VN'));

  private toLocalIso(value: Date): string {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private fromIso(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  chooseDate(iso: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const d = this.fromIso(iso);
    if (!Number.isFinite(d.getTime()) || this.toLocalIso(d) !== iso) return;
    this.selectedDate.set(iso);
    this.selectedSlot.set(null);
  }

  moveWeek(steps: number): void {
    const day = this.fromIso(this.selectedDate());
    day.setDate(day.getDate() + steps * 7);
    this.chooseDate(this.toLocalIso(day));
  }

  goToday(): void { this.chooseDate(this.toLocalIso(new Date())); }
  showSlotInfo(label: string): void { this.selectedSlot.set(label); }
  closeSlot(): void { this.selectedSlot.set(null); }
}
