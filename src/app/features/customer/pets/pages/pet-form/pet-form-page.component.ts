import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { DecisionModalService } from '../../../../../core/customer/services/decision-modal.service';
import { PetApiService } from '../../../../../core/customer/services/api/pet-api.service';
import { MedicalRecordCardComponent } from './medical-record-card.component';
import { SelectValueDirective } from '../../../../../shared/customer/directives/select-value.directive';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { petImages, PET_SPECIES_OPTIONS, getSpeciesInputValue, getAgeInputValue, ACCEPTED_MEDICAL_FILE_TYPES, MAX_MEDICAL_FILE_SIZE, createUploadedFile, getFileUrl, isImageFile } from './pet-form-page.helpers';
import { toPetSlug } from '../my-pet/pet-list-page.helpers';

const uploadIcon = '/assets/customer/icons/upload-icon.png';

/**
 * PetFormPage — chuyển từ React: src/pages/Pet/PetFormPage.jsx
 */
@Component({
  selector: 'div[app-pet-form-page]',
  standalone: true,
  imports: [NgTemplateOutlet, MedicalRecordCardComponent, SelectValueDirective, ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './pet-form-page.component.html',
  styleUrl: './pet-form-page.component.scss',
  host: {
    'class': 'max-w-4xl mx-auto pb-10 pt-6 px-4 font-sans',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetFormPageComponent {
  readonly embedded = input(false);
  readonly onSaved = output<any>();
  readonly onCancel = output<void>();

  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly decisionModalService = inject(DecisionModalService);
  protected readonly petApi = inject(PetApiService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly PET_SPECIES_OPTIONS: any = PET_SPECIES_OPTIONS;
  protected readonly getAgeInputValue: any = getAgeInputValue;
  protected readonly getFileUrl: any = getFileUrl;
  protected readonly isImageFile: any = isImageFile;
  protected readonly uploadIcon: any = uploadIcon;

  // --- Giá trị tính toán (computed) ---
  readonly isEdit = computed<any>(() => Boolean(this.navService.params()['id'] && this.navService.params()['id'] !== "new"));
  readonly pet = computed<any>(() => {
    if (!this.isEdit()) return null;
    const petId = this.resolvedPetId() || String(this.navService.params()['id'] || "");
    return this.allPets().find((p: any) =>
      String(p.id) === petId || String(p.pet_id) === petId || String(p._id) === petId,
    ) || null;
  });
  readonly currentPetImage = computed<any>(() => this.avatarPreview() || (this.pet()?.name ? (petImages as any)[this.pet().name] : null));
  readonly defaultHealthStatus = computed<any>(() => this.pet()?.healthStatus === 'Bình thường' || this.pet()?.healthStatus === 'Khỏe mạnh'|| this.pet()?.healthStatus === 'NORMAL' ? 'Bình thường' : (this.pet()?.healthStatus || "Bình thường"));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly allPets = signal<any>([]);
  /** Id thật của thú cưng (route chỉ chứa slug, vd. bong-d58) */
  readonly resolvedPetId = signal<any>("");
  readonly healthStatusInput = signal<any>("Bình thường");
  readonly selectedSpeciesId = signal<any>("");
  readonly speciesOtherInput = signal<any>("");
  readonly breedInput = signal<any>("");
  readonly formError = signal<any>("");
  readonly saving = signal<any>(false);
  readonly showDeleteModal = signal<any>(false);
  readonly showMedicalModal = signal<any>(false);
  readonly formTouched = signal<any>(false);
  readonly showHistoryModal = signal<any>(false);
  readonly showDeleteMedicalConfirm = signal<any>(false);
  readonly medicalToDelete = signal<any>(null);
  readonly medicalRecords = signal<any>([]);
  readonly medicalModalMode = signal<any>('create');
  readonly editingMedicalId = signal<any>(null);
  readonly newMedicalName = signal<any>("");
  readonly newMedicalDoctor = signal<any>("");
  readonly newMedicalDate = signal<any>("");
  readonly newMedicalNotes = signal<any>("");
  readonly newMedicalFile = signal<any>(null);
  readonly avatarPreview = signal<any>(null);
  /** Id các bệnh án đã có trên server lúc mở form (để biết bản nào bị xóa khi lưu) */
  readonly originalMedicalRecordIds = signal<string[]>([]);

  constructor() {
    // useEffect(..., [petId, isEdit])
    effect((onCleanup: any) => {
      this.navService.params()['id'];
      this.isEdit();
      const cleanup = untracked(() => {
        let active = true;

        const petId = String(this.navService.params()['id'] || "");
        const requests = this.isEdit()
          ? this.petApi.getMyPets().then(async (pets: any[]) => {
              const availablePets = pets;
              const target = petId.toLowerCase().trim();
              const currentPetFromList = availablePets.find((pet: any) => {
                const id = String(pet.id || pet.pet_id || pet._id || '').toLowerCase();
                const name = String(pet.name || '').toLowerCase();
                const slug = toPetSlug(pet).toLowerCase();
                return (
                  id === target ||
                  slug === target ||
                  name === target ||
                  (target && target.startsWith(name)) ||
                  (id && target.endsWith(id.slice(-4)))
                );
              });
              const resolvedPetId = String(
                currentPetFromList?.id ||
                currentPetFromList?.pet_id ||
                currentPetFromList?._id ||
                petId,
              );
              const results = await Promise.allSettled([
                this.petApi.getPetDetails(resolvedPetId),
                this.petApi.getMedicalRecordsByPet(resolvedPetId),
              ]);
              return { availablePets, currentPetFromList, resolvedPetId, results };
            })
          : Promise.resolve(null);

        requests.then((result: any) => {
          if (!active) return;

          if (!this.isEdit()) return;

          const pets = result?.availablePets || [];
          const petResult: any = result?.results?.[0];
          const recordsResult: any = result?.results?.[1];
          this.allPets.set(pets);
          this.resolvedPetId.set(result?.resolvedPetId || "");

          const currentPet = petResult?.status === "fulfilled"
            ? petResult.value
            : result?.currentPetFromList;

          if (currentPet) {
            if (!this.resolvedPetId()) {
              this.resolvedPetId.set(String(currentPet.id || currentPet.pet_id || currentPet._id || ""));
            }
            this.allPets.update((currentPets: any[]) => {
              const existingIndex = currentPets.findIndex(
                (pet: any) => String(pet.id) === String(currentPet.id) || String(pet.pet_id) === String(currentPet.pet_id),
              );
              if (existingIndex < 0) return [currentPet, ...currentPets];
              return currentPets.map((pet: any, index: number) => index === existingIndex ? { ...pet, ...currentPet } : pet);
            });
            this.selectedSpeciesId.set(getSpeciesInputValue(currentPet));
            this.speciesOtherInput.set(
              getSpeciesInputValue(currentPet) === "other" &&
              String(currentPet.species || currentPet.speciesName || currentPet.species_name || "").toLowerCase() !== "khác"
                ? currentPet.species || currentPet.speciesName || currentPet.species_name || ""
                : "",
            );
            this.breedInput.set(currentPet.breed || currentPet.breedName || "");
            this.healthStatusInput.set(this.defaultHealthStatus());
            this.avatarPreview.set(
              currentPet.avatar ||
              (currentPet.name && (petImages as any)[currentPet.name]) ||
              null,
            );
            const apiRecords = recordsResult?.status === "fulfilled" ? recordsResult.value || [] : [];
            this.medicalRecords.set(apiRecords);
            this.originalMedicalRecordIds.set(apiRecords.map((record: any) => String(record.id)));
            return;
          }

          this.formError.set("Không tìm thấy hồ sơ thú cưng");
        });

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected handleAvatarChange(e: any) {
    const file = e.target.files[0];
    if (file) {
      this.formTouched.set(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        this.avatarPreview.set(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

    protected goBackToPetList() {
    if (this.isEdit()) {
      const currentPet = this.pet();
      const targetSlug = currentPet
        ? toPetSlug(currentPet)
        : String(this.navService.params()['id'] || '');

      if (targetSlug) {
        this.navService.navigate(`/thu-cung-cua-toi/${targetSlug}`);
        return;
      }
    }
    this.navService.navigate('/thu-cung-cua-toi');
  }


  protected handleLeaveForm(event: any) {
    event?.preventDefault();

    if (this.embedded()) {
      if (!this.formTouched()) {
        this.onCancel.emit();
        return;
      }

      this.decisionModalService.confirmCancel({
        message: "Bạn chắc chắn muốn quay lại?\nCác thông tin vừa nhập sẽ không được lưu",
        cancelLabel: "Ở lại",
        confirmLabel: "Hủy",
        onConfirm: () => this.onCancel.emit(),
      });
      return;
    }

    if (!this.formTouched()) {
      this.goBackToPetList();
      return;
    }

    this.decisionModalService.confirmCancel({
      message: "Bạn chắc chắn muốn quay lại?\nCác thông tin vừa nhập sẽ không được lưu",
      cancelLabel: "Ở lại",
      confirmLabel: "Hủy",
      onConfirm: this.goBackToPetList.bind(this),
    });
  }

  protected async handleConfirmDelete() {
    try {
      this.saving.set(true);
      this.formError.set("");
      await this.petApi.deletePet(this.resolvedPetId() || this.navService.params()['id']);
      this.showDeleteModal.set(false);
      this.navService.navigate("/thu-cung-cua-toi");
    } catch (error: any) {
      this.formError.set(error?.message || "Không thể xóa hồ sơ");
    } finally {
      this.saving.set(false);
    }
  }

  protected async handleSubmit(e: any) {
    e.preventDefault();
    const formData = new FormData(e.target); 

    const genderValue = formData.get("gender");
    const weightInput = formData.get("weight");
    const ageInput = formData.get("age");
    const customSpecies = String(formData.get("customSpecies") || "").trim();
    const speciesId = String(formData.get("speciesId") || this.selectedSpeciesId() || "");
    const selectedSpecies = PET_SPECIES_OPTIONS.find((option: any) => option.value === speciesId);
    
    const petData = {
      name: formData.get("name"),
      speciesId,

      species: speciesId === "other"
        ? customSpecies
        : selectedSpecies?.label || "",

      breed: formData.get("breed"),
      age: ageInput || null, 
      gender: genderValue,
      weightKg: weightInput || null,
      medicalNotes: formData.get("medicalNotes") || "", 
      healthStatus: formData.get("healthStatus"), 
      avatar: this.avatarPreview(), 
      medicalRecords: this.medicalRecords(),
    };

    try {
      this.saving.set(true);
      this.formError.set("");
      let savedPet: any;
      if (this.isEdit()) {
        savedPet = await this.petApi.updatePet(this.resolvedPetId() || this.navService.params()['id'], petData);
      } else {
        savedPet = await this.petApi.createPet(petData);
      }

      const backendPetId = savedPet?.id || savedPet?.pet_id || this.resolvedPetId();
      if (!backendPetId) throw new Error("Không xác định được mã thú cưng sau khi lưu");

      const toPayload = (record: any) => ({
        petId: backendPetId,
        condition: record.condition,
        doctor: record.doctor,
        visitDate: record.visitDate || record.date?.split("/").reverse().join("-"),
        notes: record.notes,
        attachments: record.file ? [record.file] : [],
      });
      const currentIds = new Set(this.medicalRecords().map((record: any) => String(record.id)));
      const deletedIds = this.originalMedicalRecordIds().filter((id: string) => !currentIds.has(id));

      const recordResults = await Promise.allSettled([
        ...this.medicalRecords()
          .filter((record: any) => record.isNew)
          .map((record: any) => this.petApi.createMedicalRecord(toPayload(record))),
        ...this.medicalRecords()
          .filter((record: any) => !record.isNew && record.isDirty)
          .map((record: any) => this.petApi.updateMedicalRecord(record.id, toPayload(record))),
        ...deletedIds.map((id: string) => this.petApi.deleteMedicalRecord(id)),
      ]);

      const savedPetForParent = { ...savedPet, id: backendPetId, name: petData.name };
      if (recordResults.some((result: any) => result.status === "rejected")) {
        alert("Đã lưu hồ sơ nhưng có bệnh án chưa lưu được lên hệ thống. Vui lòng kiểm tra lại.");
        if (this.embedded()) {
          this.onSaved.emit(savedPetForParent);
          return;
        }
        this.navService.navigate(`/thu-cung-cua-toi/${toPetSlug({ ...savedPet, id: backendPetId, name: petData.name })}`);
        return;
      }

      if (this.embedded()) {
        this.onSaved.emit(savedPetForParent);
        return;
      }
        if (this.isEdit()) {
            this.navService.navigate(`/thu-cung-cua-toi/${toPetSlug(savedPetForParent)}`);
            return;
          }

      this.navService.navigate('/thu-cung-cua-toi');
    } catch (error: any) {
      this.formError.set(error?.message || "Không thể lưu hồ sơ. Vui lòng thử lại.");
    } finally {
      this.saving.set(false);
    }
  }

  protected handleOpenCreateMedical() {
    this.newMedicalName.set(""); this.newMedicalDoctor.set(""); this.newMedicalDate.set(""); this.newMedicalNotes.set("");
    this.newMedicalFile.set(null);
    this.medicalModalMode.set('create');
    this.editingMedicalId.set(null);
    this.showMedicalModal.set(true);
  }

  protected handleOpenEditMedical(record: any) {
    let formattedDateForInput = "";
    if (record.date && record.date !== "Chưa khám") {
      const parts = record.date.split("/");
      if (parts.length === 3) formattedDateForInput = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    this.newMedicalName.set(record.condition || record.name.replace(".pdf", ""));
    this.newMedicalDoctor.set(record.doctor || "");
    this.newMedicalDate.set(formattedDateForInput);
    this.newMedicalNotes.set(record.notes || "");
    this.newMedicalFile.set(record.fileUrl ? {
      id: record.fileUrl,
      name: record.fileName || record.name || "Tài liệu đính kèm",
      size: record.size || "PDF",
      fileUrl: record.fileUrl,
    } : null);

    this.medicalModalMode.set('edit');
    this.editingMedicalId.set(record.id);
    this.showHistoryModal.set(false);
    this.showMedicalModal.set(true);
  }

  protected closeMedicalModal() {
    this.showMedicalModal.set(false);
  }

  protected handleCloseMedicalModal() {
    const hasMedicalDraft =
      this.newMedicalName().trim() ||
      this.newMedicalDoctor().trim() ||
      this.newMedicalDate() ||
      this.newMedicalNotes().trim();

    if (!hasMedicalDraft) {
      this.closeMedicalModal();
      return;
    }

    this.decisionModalService.confirmCancel({
      message: "Bạn chắc chắn muốn đóng lại?\nCác thông tin vừa nhập sẽ không được lưu",
      cancelLabel: "Ở lại",
      confirmLabel: "Hủy",
      onConfirm: this.closeMedicalModal.bind(this),
    });
  }

  protected handleSaveMedicalRecord(e: any) {
    e.preventDefault();
    if (!this.newMedicalName() || !this.newMedicalDate()) {
      alert("Vui lòng nhập tên bệnh án và ngày khám!");
      return;
    }

    const [y, m, d] = this.newMedicalDate().split("-");
    const formattedDate = `${d}/${m}/${y}`;

    if (this.medicalModalMode() === 'edit' && this.editingMedicalId()) {
      const updatedRecords = this.medicalRecords().map((r: any) => {
        if (r.id === this.editingMedicalId()) {
          return {
            ...r,
            date: formattedDate,
            condition: this.newMedicalName(),
            doctor: this.newMedicalDoctor(),
            notes: this.newMedicalNotes(),
            name: this.newMedicalFile()?.name || this.newMedicalName() + ".pdf",
            size: this.newMedicalFile()?.size || r.size || "PDF",
            fileUrl: this.newMedicalFile()?.fileUrl || r.fileUrl || `${this.newMedicalName().replace(/\s+/g, '-')}.pdf`,
            fileName: this.newMedicalFile()?.name || r.fileName || r.name,
            file: this.newMedicalFile()?.file || r.file,
            visitDate: this.newMedicalDate(),
            isDirty: true,
          };
        }
        return r;
      });
      this.medicalRecords.set(updatedRecords);
    } else {
      const newRecord = {
        id: Date.now(),
        name: this.newMedicalFile()?.name || this.newMedicalName() + ".pdf",
        size: this.newMedicalFile()?.size || "PDF",
        date: formattedDate,
        condition: this.newMedicalName(),
        doctor: this.newMedicalDoctor() || "Chưa rõ",
        notes: this.newMedicalNotes() || "Không có ghi chú y tế.",
        fileUrl: this.newMedicalFile()?.fileUrl || `${this.newMedicalName().replace(/\s+/g, '-')}.pdf`,
        fileName: this.newMedicalFile()?.name || this.newMedicalName() + ".pdf",
        file: this.newMedicalFile()?.file,
        visitDate: this.newMedicalDate(),
        isNew: true,
      };
      this.medicalRecords.set([newRecord, ...this.medicalRecords()]);
    }

    this.formTouched.set(true);
    this.showMedicalModal.set(false);
    this.newMedicalName.set("");
    this.newMedicalDoctor.set("");
    this.newMedicalDate.set("");
    this.newMedicalNotes.set("");
    this.newMedicalFile.set(null);
  }

  protected handleConfirmDeleteMedical() {
    this.medicalRecords.set(this.medicalRecords().filter((record: any) => record.id !== this.medicalToDelete()));
    this.formTouched.set(true);
    this.showDeleteMedicalConfirm.set(false);
    this.medicalToDelete.set(null);
    if (this.showHistoryModal()) {
      this.showHistoryModal.set(false);
    }
  }

  protected handleMedicalFileChange(event: any) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_MEDICAL_FILE_TYPES.includes(file.type)) {
      alert("Chỉ hỗ trợ file PDF, JPG hoặc PNG.");
      return;
    }
    if (file.size > MAX_MEDICAL_FILE_SIZE) {
      alert("File không được vượt quá 10MB.");
      return;
    }
    this.newMedicalFile.set(createUploadedFile(file));
    this.formTouched.set(true);
  }

  protected handleDownloadFile(fileUrl: any, fileName: any = "Tài liệu đính kèm") {
    if (fileUrl) {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.target = "_blank";
      link.click();
      return;
    }
    alert("Chưa có file để tải xuống.");
  }

  protected handlePreviewFile(fileUrl: any) {
    if (!fileUrl) {
      alert("Chưa có file để xem trước.");
      return;
    }
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  }

  protected handle1() {
    (document.getElementById("pet-avatar-file") as any).click();
  }

  protected handle2(record: any) {
    this.medicalToDelete.set(record.id);
    this.showDeleteMedicalConfirm.set(true);
  }

  protected handle3(item: any) { this.medicalToDelete.set(item.id); this.showDeleteMedicalConfirm.set(true); }
}
