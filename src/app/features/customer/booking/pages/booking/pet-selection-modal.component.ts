import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, OnInit } from '@angular/core';

import { DecisionModalService } from '../../../../../core/customer/services/decision-modal.service';
import { petPickerMaxPhoto, petPickerLunaPhoto, petPickerCloseIcon, petImages } from './booking-page.helpers';
import { PetFormPageComponent } from '../../../pets/pages/pet-form/pet-form-page.component';

const buddyImg = '/assets/customer/images/pets/buddy.jpg';

@Component({
  selector: 'div[app-pet-selection-modal]',
  standalone: true,
  imports: [PetFormPageComponent],
  templateUrl: './pet-selection-modal.component.html',
  host: {
    'class': 'fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-5 backdrop-blur-sm',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetSelectionModalComponent implements OnInit {
  protected readonly decisionModalService = inject(DecisionModalService);

  // --- Input / Output ---
  readonly pets = input<any>([]);
  readonly loading = input<any>(false);
  readonly error = input<any>(undefined);
  readonly selectedPets = input<any>([]);
  readonly onConfirm = output<any>();
  readonly onClose = output<any>();
  readonly onPetCreated = output<any>(); // Trả về thú cưng mới tạo để cha cập nhật list/API

  // --- Dữ liệu ảnh ---
  protected readonly petPickerCloseIcon: any = petPickerCloseIcon;
  protected readonly petPickerMaxPhoto: any = petPickerMaxPhoto;
  protected readonly petPickerLunaPhoto: any = petPickerLunaPhoto;
  protected readonly petImages: any = petImages;
  protected readonly buddyImg: any = buddyImg;

  // --- Trạng thái chọn thú cưng ---
  readonly draftPets = signal<any>([]);

  // --- Trạng thái tạo hồ sơ thú cưng mới ---
  readonly isCreatingPet = signal<boolean>(false);

  readonly draftChanged = computed<any>(() => {
    const selectedIds = (this.selectedPets() || []).map((pet: any) => String(pet.id)).sort().join('|');
    const draftIds = (this.draftPets() || []).map((pet: any) => String(pet.id)).sort().join('|');
    return selectedIds !== draftIds;
  });

  // Danh sách thú cưng hiển thị (gộp danh sách từ cha + thú cưng vừa tạo tạm thời nếu cha chưa kịp reload)
  readonly localCreatedPets = signal<any[]>([]);
  readonly displayPets = computed(() => {
    const parentPets = this.pets() || [];
    const created = this.localCreatedPets().filter(
      (lp) => !parentPets.some((pp: any) => String(pp.id) === String(lp.id))
    );
    return [...parentPets, ...created];
  });

  protected readonly onCloseFn = (...args: any[]): void => this.onClose.emit(args.length > 1 ? args : args[0]);

  ngOnInit(): void {
    this.draftPets.set(this.selectedPets() || []);
  }

  protected togglePet(pet: any) {
    this.draftPets.update((current: any) =>
      current.some((item: any) => item.id === pet.id)
        ? current.filter((item: any) => item.id !== pet.id)
        : [...current, pet]
    );
  }

  // --- Các hàm xử lý Thêm hồ sơ thú cưng mới ---
  protected openCreatePetForm() {
    this.isCreatingPet.set(true);
  }

  protected cancelCreatePet() {
    this.isCreatingPet.set(false);
  }

  protected handlePetSaved(createdPet: any) {
    this.localCreatedPets.update((prev) => [...prev, createdPet]);
    this.draftPets.update((prev) => [...prev, createdPet]);
    this.onPetCreated.emit(createdPet);
    this.isCreatingPet.set(false);
  }

  protected handleClose() {
    if (!this.draftChanged() && !this.isCreatingPet()) {
      this.onClose.emit(undefined);
      return;
    }

    this.decisionModalService.confirmCancel({
      message: 'Bạn chắc chắn muốn đóng lại?\nLựa chọn vừa thay đổi sẽ không được lưu',
      cancelLabel: 'Ở lại',
      confirmLabel: 'Hủy',
      onConfirm: this.onCloseFn,
    });
  }

  protected classes1(pet: any): any {
    const isSelected = this.draftPets().some((item: any) => item.id === pet.id);
    return `flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left ${
      isSelected
        ? 'border-[#2b5496] bg-white shadow-xs'
        : 'border-slate-200/80 bg-[#f8fafc] hover:bg-slate-100/70'
    }`;
  }

  protected classes2(pet: any): any {
    const isSelected = this.draftPets().some((item: any) => item.id === pet.id);
    return `rounded-full px-4 py-1.5 text-[13px] font-semibold ${
      isSelected
        ? 'bg-[#2b5496] text-white'
        : 'bg-[#e2e8f0] text-slate-800 hover:bg-slate-300'
    }`;
  }

  protected cond3(pet: any): any {
    return this.draftPets().some((item: any) => item.id === pet.id);
  }
}
