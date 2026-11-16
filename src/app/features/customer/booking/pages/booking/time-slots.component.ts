import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { BookingCardComponent } from './booking-card.component';
import { isBeforeToday, isSlotInPast } from './booking-page.helpers';

/**
 * TimeSlots — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'app-time-slots',
  standalone: true,
  imports: [BookingCardComponent],
  templateUrl: './time-slots.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeSlotsComponent {
  // --- Input / Output (props của React) ---
  readonly selectedDate = input<any>(undefined);
  readonly selectedSlot = input<any>(undefined);
  readonly onSelect = output<any>();
  readonly timeSlots = input<any>(undefined);
  readonly invalid = input<any>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly isBeforeToday: any = isBeforeToday;
  protected readonly isSlotInPast: any = isSlotInPast;

  readonly visibleSlots = computed<any>(() => {
    const slots = this.timeSlots() || [];
    const date = this.selectedDate();
    return slots.filter((slot: any) => {
      // Must be available and have remaining capacity
      if (slot.available === false) return false;
      if (typeof slot.remaining === 'number' && slot.remaining <= 0) return false;
      if (slot.maxAppointments && slot.bookedCount >= slot.maxAppointments) return false;
      // Must not be in the past for today
      if (date && isSlotInPast(slot.value, date)) return false;
      return true;
    });
  });
}
