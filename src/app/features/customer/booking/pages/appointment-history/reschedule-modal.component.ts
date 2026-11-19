import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingApiService } from '../../../../../core/customer/services/api/booking-api.service';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';

@Component({
  selector: 'div[app-reschedule-modal]',
  standalone: true,
  imports: [CommonModule, CustomerIconComponent],
  templateUrl: './reschedule-modal.component.html',
  host: {
    'class': 'overlay-fade-in fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,16,90,0.3)] px-4 backdrop-blur-sm',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RescheduleModalComponent {
  private readonly bookingApi = inject(BookingApiService);

  readonly appointment = input<any>(undefined);
  readonly onClose = output<void>();
  readonly onSuccess = output<any>();

  readonly minDate = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  readonly selectedDate = signal<string>(this.minDate());
  readonly slots = signal<any[]>([]);
  readonly selectedSlot = signal<any>(null);
  readonly isLoadingSlots = signal<boolean>(false);
  readonly slotsLoadError = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string>('');

  readonly allSlotsBlocked = computed<boolean>(() => {
    const list = this.slots();
    return list.length > 0 && list.every((slot: any) => this.getSlotStatus(slot) === 'BLOCKED');
  });

  readonly allSlotsUnavailable = computed<boolean>(() => {
    const list = this.slots();
    return list.length > 0 && list.every((slot: any) => !this.isSlotBookable(slot));
  });

  constructor() {
    afterNextRender(() => {
      this.loadSlotsForDate(this.selectedDate());
    });
  }

  protected onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectedDate.set(input.value);
      this.selectedSlot.set(null);
      this.loadSlotsForDate(input.value);
    }
  }

  protected async loadSlotsForDate(dateStr: string) {
    const apt = this.appointment();
    if (!apt) return;

    this.isLoadingSlots.set(true);
    this.slotsLoadError.set('');
    this.errorMessage.set('');

    const branchId = apt.branch?.id || apt.branchId || apt.branch_id;
    const serviceIds = (apt.services && apt.services.length)
      ? apt.services.map((s: any) => s.serviceId || s.id || s._id)
      : [apt.service?.id || apt.serviceId];

    try {
      const groupedSlots = await this.bookingApi.getAppointmentSlots({
        date: dateStr,
        branchId,
        serviceIds,
      });

      let flatSlots: any[] = [];
      if (Array.isArray(groupedSlots)) {
        for (const item of groupedSlots) {
          if (Array.isArray(item.slots)) {
            flatSlots.push(...item.slots);
          } else {
            flatSlots.push(item);
          }
        }
      }
      this.slots.set(flatSlots);
      if (this.selectedSlot() && !flatSlots.some((s) => this.isSlotBookable(s) && (s.value === this.selectedSlot()?.value || s.time === this.selectedSlot()?.time))) {
        this.selectedSlot.set(null);
      }
    } catch (err: any) {
      const msg = err?.data?.detail || err?.data?.message || err?.message || 'Không thể tải khung giờ cho ngày này. Vui lòng thử lại sau.';
      this.slotsLoadError.set(msg);
      this.slots.set([]);
      this.selectedSlot.set(null);
    } finally {
      this.isLoadingSlots.set(false);
    }
  }

  protected getSlotStatus(slot: any): 'AVAILABLE' | 'FULL' | 'BLOCKED' {
    const raw = String(slot?.status || '').trim().toUpperCase();
    if (raw === 'BLOCKED' || slot?.isBlocked === true) return 'BLOCKED';
    if (
      raw === 'FULL' ||
      slot?.available === false ||
      (typeof slot?.remaining === 'number' && slot.remaining <= 0) ||
      (slot?.maxAppointments && (slot?.bookedCount || 0) >= slot.maxAppointments)
    ) {
      return 'FULL';
    }
    return 'AVAILABLE';
  }

  protected isSlotBookable(slot: any): boolean {
    return this.getSlotStatus(slot) === 'AVAILABLE';
  }

  protected selectSlot(slot: any) {
    if (!this.isSlotBookable(slot)) return;
    this.selectedSlot.set(slot);
    this.errorMessage.set('');
  }

  protected async submitReschedule() {
    const slot = this.selectedSlot();
    const apt = this.appointment();
    if (!slot || !this.isSlotBookable(slot) || !apt) {
      this.errorMessage.set('Vui lòng chọn khung giờ mới còn chỗ.');
      return;
    }

    const startTimePart = String(slot.time || slot.value || '').split(' - ')[0].trim();
    const newSlotStart = slot.start || slot.slotStart || `${this.selectedDate()}T${startTimePart}:00.000Z`;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const updatedApt = await this.bookingApi.rescheduleAppointment(apt.id, newSlotStart);
      this.onSuccess.emit({
        appointmentId: apt.id,
        newSlotStart,
        slotValue: slot.value || slot.time,
        date: this.selectedDate(),
        updatedApt,
      });
    } catch (err: any) {
      this.errorMessage.set(err?.data?.detail || err?.data?.message || err?.message || 'Không thể đổi lịch hẹn lúc này.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
