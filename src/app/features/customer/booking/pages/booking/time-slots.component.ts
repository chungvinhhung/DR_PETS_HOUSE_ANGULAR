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
  styleUrl: './time-slots.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeSlotsComponent {
  // --- Input / Output (props của React) ---
  readonly selectedDate = input<any>(undefined);
  readonly selectedSlot = input<any>(undefined);
  readonly onSelect = output<any>();
  readonly timeSlots = input<any>(undefined);
  readonly slotsLoading = input<boolean>(false);
  readonly slotsError = input<string>("");
  readonly slotsState = input<string>("idle");
  readonly onRetry = output<void>();
  readonly hasSelectedService = input<boolean>(true);
  readonly invalid = input<any>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly isBeforeToday: any = isBeforeToday;
  protected readonly isSlotInPast: any = isSlotInPast;

  /** Danh sách tất cả slot của ngày đang chọn (loại bỏ slot đã qua giờ nếu là hôm nay) */
  readonly displaySlots = computed<any[]>(() => {
    if (!this.hasSelectedService() || this.slotsError()) return [];
    const slots = Array.isArray(this.timeSlots()) ? this.timeSlots() : [];
    const date = this.selectedDate();
    if (!date || isBeforeToday(date)) return [];
    return slots.filter((slot: any) => !isSlotInPast(slot.value, date));
  });

  /** Danh sách các slot còn chỗ và có thể đặt được */
  readonly visibleSlots = computed<any[]>(() => {
    return this.displaySlots().filter((slot: any) => this.isSlotBookableItem(slot));
  });

  readonly allDisplaySlotsBlocked = computed<boolean>(() => {
    const list = this.displaySlots();
    return list.length > 0 && list.every((slot: any) => this.getSlotStatus(slot) === 'BLOCKED');
  });

  readonly allDisplaySlotsUnavailable = computed<boolean>(() => {
    const list = this.displaySlots();
    return list.length > 0 && this.visibleSlots().length === 0;
  });

  protected getSlotStatus(slot: any): 'AVAILABLE' | 'FULL' | 'BLOCKED' {
    const raw = String(slot?.status || '').trim().toUpperCase();
    if (raw === 'BLOCKED' || slot?.isBlocked === true) return 'BLOCKED';
    if (
      raw === 'FULL' ||
      slot?.available === false ||
      (typeof slot?.remaining === 'number' && slot.remaining <= 0) ||
      (slot?.maxAppointments && slot?.bookedCount >= slot.maxAppointments)
    ) {
      return 'FULL';
    }
    return 'AVAILABLE';
  }

  protected isSlotBookableItem(slot: any): boolean {
    const date = this.selectedDate();
    if (!date || isBeforeToday(date) || isSlotInPast(slot?.value, date)) return false;
    return this.getSlotStatus(slot) === 'AVAILABLE';
  }

  protected handleSelectSlot(slot: any): void {
    if (!this.isSlotBookableItem(slot)) return;
    this.onSelect.emit(slot.value);
  }
}
