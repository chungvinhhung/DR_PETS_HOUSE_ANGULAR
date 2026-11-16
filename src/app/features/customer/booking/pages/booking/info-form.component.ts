import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { CustomerAuthService } from '../../../../../core/customer/services/customer-auth.service';
import { PetSummaryCardComponent } from './pet-summary-card.component';
import { PetInfoCardComponent } from './pet-info-card.component';
import { BookingCardComponent } from './booking-card.component';
import { BookingFieldComponent } from './booking-field.component';
import { FlowButtonsComponent } from './flow-buttons.component';
import { PetSelectionModalComponent } from './pet-selection-modal.component';
import { serviceSelectedCheck, createEmptyPetInfo, profileToPetInfo, isPetInfoComplete } from './booking-page.helpers';

/**
 * InfoForm — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'app-info-form',
  standalone: true,
  imports: [PetSummaryCardComponent, PetInfoCardComponent, BookingCardComponent, BookingFieldComponent, FlowButtonsComponent, PetSelectionModalComponent],
  templateUrl: './info-form.component.html',
  styleUrl: './info-form.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoFormComponent {
  private readonly authService = inject(CustomerAuthService);

  // --- Input / Output (props của React) ---
  readonly selectedPets = input<any>(undefined);
  readonly setSelectedPets = input<any>(undefined);
  readonly petInfos = input<any>(undefined);
  readonly setPetInfos = input<any>(undefined);
  readonly ownerInfo = input<any>(undefined);
  readonly setOwnerInfo = input<any>(undefined);
  readonly pets = input<any>(undefined);
  readonly petsLoading = input<any>(undefined);
  readonly petsError = input<any>(undefined);
  readonly onBack = output<any>();
  readonly onNext = output<void>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly serviceSelectedCheck: any = serviceSelectedCheck;

  // --- Giá trị tính toán (computed) ---
  readonly profileMode = computed<any>(() => this.selectedPets().length > 0);
  readonly activePetInfos = computed<any>(() => this.petInfos().length > 0 ? this.petInfos() : [createEmptyPetInfo()]);
    // Kiểm tra định dạng số điện thoại Việt Nam
  readonly phoneValid = computed(() => {
    const phone = (this.ownerInfo()?.phone ?? '').trim();
    return /^(0\d{9,10}|\+84\d{9,10})$/.test(phone);
  });

  // Email không bắt buộc, nhưng nếu nhập phải đúng định dạng
  readonly emailValid = computed(() => {
    const email = (this.ownerInfo()?.email ?? '').trim();
    return !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  });

  // Thông báo lỗi số điện thoại
  readonly phoneError = computed(() => {
    const phone = (this.ownerInfo()?.phone ?? '').trim();

    if (!phone) return 'Vui lòng nhập số điện thoại';

    return this.phoneValid()
      ? ''
      : 'Số điện thoại không đúng định dạng';
  });

  // Thông báo lỗi email
  readonly emailError = computed(() => {
    const email = (this.ownerInfo()?.email ?? '').trim();

    return this.emailValid()
      ? ''
      : 'Email không đúng định dạng';
  });

  // Kiểm tra toàn bộ thông tin trước khi tiếp tục
  readonly infoComplete = computed<any>(() =>
    this.activePetInfos().every(isPetInfoComplete) &&
    this.ownerInfo().name.trim() &&
    this.phoneValid() &&
    this.emailValid() &&
    this.ownerInfo().agreed
  );

  // --- Trạng thái (signal = useState / useRef) ---
  readonly showPetPicker = signal<any>(false);
  readonly validationAttempted = signal<any>(false);

  protected updatePetInfo(petId: any, field: any, value: any) {
    return this.setPetInfos()((current: any) =>
      current.map((petInfo: any) =>
        petInfo.id === petId ? { ...petInfo, [field]: value } : petInfo,
      ),
    );
  }

  protected updateOwnerInfo(field: any, value: any) {
    return this.setOwnerInfo()((current: any) => ({ ...current, [field]: value }));
  }

  protected chooseOtherPet() {
    this.setSelectedPets()([]);
    this.setPetInfos()([createEmptyPetInfo()]);
  }

  protected addOtherPetInfo() {
    this.setPetInfos()((current: any) => [...current, createEmptyPetInfo()]);
  }

  protected removeOtherPetInfo(petId: any) {
    this.setPetInfos()((current: any) =>
      current.length <= 1 ? current : current.filter((petInfo: any) => petInfo.id !== petId),
    );
  }

  protected openPetPicker() {
    this.authService.requireAuth(() => this.showPetPicker.set(true));
  }

  protected handleNext() {
    if (this.infoComplete()) {
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

  protected handle1(pets: any) {
    this.setSelectedPets()(pets);
    this.setPetInfos()(pets.length > 0 ? pets.map(profileToPetInfo) : [createEmptyPetInfo()]);
    this.showPetPicker.set(false);
  }
}
