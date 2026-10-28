import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { BookingCardComponent } from './booking-card.component';
import { getDateKey, isBeforeToday } from './booking-page.helpers';

/**
 * BookingCalendar — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  imports: [BookingCardComponent],
  templateUrl: './booking-calendar.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingCalendarComponent {
  // --- Input / Output (props của React) ---
  readonly selectedDate = input<any>(undefined);
  readonly onSelect = output<any>();
  readonly invalid = input<any>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly isBeforeToday: any = isBeforeToday;

  // --- Giá trị tính toán (computed) ---
  readonly calendarCells = computed<any>(() => {
    const year = this.viewedMonth().getFullYear();
    const month = this.viewedMonth().getMonth();
    const firstDay = new Date(year, month, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - mondayOffset);

    return (Array.from({ length: 42 }, (_: any, index: any) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      return {
        date,
        key: getDateKey(date),
        inCurrentMonth: date.getMonth() === month,
      };
    }) as any);
  });
  readonly days = computed<any>(() => ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]);
  readonly todayKey = computed<any>(() => getDateKey(new Date()));
  readonly selectedDateKey = computed<any>(() => this.selectedDate() ? getDateKey(this.selectedDate()) : null);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly viewedMonth = signal<any>((() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  })());

  protected changeMonth(offset: any) {
    this.viewedMonth.update((current: any) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  protected selectDate(date: any) {
    if (isBeforeToday(date)) {
      return;
    }

    this.onSelect.emit(date);
    this.viewedMonth.set(new Date(date.getFullYear(), date.getMonth(), 1));
  }
}
