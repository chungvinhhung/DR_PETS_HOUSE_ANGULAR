import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, OnInit } from '@angular/core';

import { DecisionModalService } from '../../../../../core/customer/services/decision-modal.service';
import { petPickerMaxPhoto, petPickerLunaPhoto, petPickerCloseIcon, petImages } from './booking-page.helpers';

const buddyImg = '/assets/customer/images/pets/buddy.jpg';

/**
 * PetSelectionModal — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'div[app-pet-selection-modal]',
  standalone: true,
  imports: [],
  templateUrl: './pet-selection-modal.component.html',
  host: {
    'class': 'fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-5 backdrop-blur-sm',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetSelectionModalComponent implements OnInit {
  // --- Service dùng chung ---
  protected readonly decisionModalService = inject(DecisionModalService);

  // --- Input / Output (props của React) ---
  readonly pets = input<any>(undefined);
  readonly loading = input<any>(undefined);
  readonly error = input<any>(undefined);
  readonly selectedPets = input<any>(undefined);
  readonly onConfirm = output<any>();
  readonly onClose = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly petPickerCloseIcon: any = petPickerCloseIcon;
  protected readonly petPickerMaxPhoto: any = petPickerMaxPhoto;
  protected readonly petPickerLunaPhoto: any = petPickerLunaPhoto;
  protected readonly petImages: any = petImages;
  protected readonly buddyImg: any = buddyImg;

  // --- Giá trị tính toán (computed) ---
  readonly draftChanged = computed<any>(() => {
    const selectedIds = this.selectedPets().map((pet: any) => String(pet.id)).sort().join("|");
    const draftIds = this.draftPets().map((pet: any) => String(pet.id)).sort().join("|");
    return selectedIds !== draftIds;
  });

  // --- Trạng thái (signal = useState / useRef) ---
  readonly draftPets = signal<any>(undefined);

  /** Dùng output "onClose" như một hàm callback (React truyền thẳng prop onClose) */
  protected readonly onCloseFn = (...args: any[]): void => this.onClose.emit(args.length > 1 ? args : args[0]);

  ngOnInit(): void {
    this.draftPets.set(this.selectedPets());
  }

  protected togglePet(pet: any) {
    this.draftPets.update((current: any) =>
      current.some((item: any) => item.id === pet.id)
        ? current.filter((item: any) => item.id !== pet.id)
      : [...current, pet]);
  }

  protected handleClose() {
    if (!this.draftChanged()) {
      this.onClose.emit(undefined);
      return;
    }

    this.decisionModalService.confirmCancel({
      message: "Bạn chắc chắn muốn đóng lại?\nLựa chọn vừa thay đổi sẽ không được lưu",
      cancelLabel: "Ở lại",
      confirmLabel: "Hủy",
      onConfirm: this.onCloseFn,
    });
  }

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected classes1(pet: any): any {
    return `flex w-full items-center gap-4 rounded-2xl border-2 p-[18px] text-left md:p-4 ${
                this.draftPets().some((item: any) => item.id === pet.id) ? "border-blue-900 bg-blue-50" : "border-slate-200"
              }`;
  }

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected classes2(pet: any): any {
    return `rounded-full px-4 py-1.5 text-xs font-bold ${
                  this.draftPets().some((item: any) => item.id === pet.id)
                    ? "bg-blue-900 text-white"
                    : "bg-slate-200 text-slate-700"
                }`;
  }

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected cond3(pet: any): any {
    return this.draftPets().some((item: any) => item.id === pet.id);
  }
}
