import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { BranchSelectionCardComponent } from './branch-selection-card.component';
import { BookingCardComponent } from './booking-card.component';
import { AssetIconComponent } from './asset-icon.component';
import { BookingCalendarComponent } from './booking-calendar.component';
import { TimeSlotsComponent } from './time-slots.component';
import { FlowButtonsComponent } from './flow-buttons.component';
import { BOOKING_SERVICE_TYPES } from '../../data/booking-data';
import { productImages } from '../../../../../shared/customer/assets/product-images';
import { serviceListIcon, serviceSelectedCheck, formatMoney, isBeforeToday, isSlotBookable } from './booking-page.helpers';

/**
 * ServiceSelection — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'app-service-selection',
  standalone: true,
  imports: [BranchSelectionCardComponent, BookingCardComponent, AssetIconComponent, BookingCalendarComponent, TimeSlotsComponent, FlowButtonsComponent],
  templateUrl: './service-selection.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceSelectionComponent {
  // --- Input / Output (props của React) ---
  readonly selectedServiceType = input<any>(undefined);
  readonly setSelectedServiceType = input<any>(undefined);
  readonly selectedServices = input<any>(undefined);
  readonly setSelectedServices = input<any>(undefined);
  readonly selectedPets = input<any>([]);
  readonly petInfos = input<any>([]);
  readonly selectedDate = input<any>(undefined);
  readonly setSelectedDate = input<any>(undefined);
  readonly selectedSlot = input<any>(undefined);
  readonly setSelectedSlot = input<any>(undefined);
  readonly ownerInfo = input<any>(undefined);
  readonly setOwnerInfo = input<any>(undefined);
  readonly branches = input<any>(undefined);
  readonly services = input<any>(undefined);
  readonly timeSlots = input<any>(undefined);
  readonly slotsLoading = input<any>(undefined);
  readonly onNext = output<void>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly BOOKING_SERVICE_TYPES: any = BOOKING_SERVICE_TYPES;
  protected readonly serviceSelectedCheck: any = serviceSelectedCheck;
  protected readonly serviceListIcon: any = serviceListIcon;
  protected readonly productImages: any = productImages;
  protected readonly formatMoney: any = formatMoney;

  // --- Giá trị tính toán (computed) ---
  readonly visibleServices = computed<any>(() => {
    const keyword = this.serviceSearch().trim().toLocaleLowerCase("vi");
    return this.services().filter((service: any) => {
      const matchesType = !this.selectedServiceType() || service.serviceTypeId === this.selectedServiceType();
      const matchesSearch =
        !keyword ||
        [service.name, service.desc]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(keyword);
      return matchesType && matchesSearch;
    });
  });
  readonly total = computed<any>(() => this.services()
      .filter((item: any) => this.selectedServices().includes(item.id))
      .reduce((sum: any, item: any) => sum + item.price * this.serviceQuantity(), 0));
  readonly serviceQuantity = computed<any>(() => Math.max(this.selectedPets().length || this.petInfos().length || 1, 1));
  readonly dateBookable = computed<any>(() => this.selectedDate() && !isBeforeToday(this.selectedDate()));
  readonly slotBookable = computed<any>(() => this.selectedSlot() && isSlotBookable(this.selectedSlot(), this.selectedDate(), this.timeSlots()));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly validationAttempted = signal<any>(false);
  readonly serviceSearch = signal<any>("");

  protected toggleService(id: any) {
    this.setSelectedServices()((current: any) =>
      current.includes(id) ? current.filter((item: any) => item !== id) : [...current, id],
    );
  }

  protected selectBranch(branch: any) {
    this.setOwnerInfo()((current: any) => ({ ...current, branch }));
    this.setSelectedSlot()(null);
  }

  protected selectDate(date: any) {
    this.setSelectedDate()(date);
    this.setSelectedSlot()((current: any) => {
      return current && isSlotBookable(current, date, this.timeSlots()) ? current : null;
    });
  }

  protected selectServiceType(serviceTypeId: any) {
    this.setSelectedServiceType()(serviceTypeId);
    this.setSelectedSlot()(null);
    this.setSelectedServices()((current: any) => {
      const allowedServiceIds = new Set<any>(
        this.services().filter((service: any) => service.serviceTypeId === serviceTypeId).map((service: any) => service.id),
      );

      return current.filter((serviceId: any) => allowedServiceIds.has(serviceId));
    });
  }

  protected handleNext() {
    if (this.selectedServiceType() && this.selectedServices().length > 0 && this.ownerInfo().branch && this.dateBookable() && this.slotBookable()) {
      this.onNext.emit();
      return;
    }

    this.validationAttempted.set(true);
    window.setTimeout(() => {
      const firstInvalid = (document.querySelector('[data-booking-error="true"]') as any);
      firstInvalid?.focus();
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }
}
