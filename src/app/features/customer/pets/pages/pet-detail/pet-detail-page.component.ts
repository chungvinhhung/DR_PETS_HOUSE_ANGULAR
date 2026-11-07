import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { DecisionModalService } from '../../../../../core/customer/services/decision-modal.service';
import { PetApiService } from '../../../../../core/customer/services/api/pet-api.service';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { INITIAL_PET_EVENTS } from '../../data/pet-events';
import { petImages, matchPetBySlugOrId, calculateAge, formatAgeText, ACCEPTED_UPLOAD_FILE_TYPES, MAX_UPLOAD_FILE_SIZE, createUploadedFile, getFileUrl, isImageFile, getUploadFiles, getColorClass, convertTimeToInputFormat, formatTimeToSACH, toDateKey, isEventInDate, toPetSlug } from './pet-detail-page.helpers';

const lunaImg = '/assets/customer/images/pets/luna.jpg';
const patternBg = '/assets/customer/images/pets/patterntaddnote.jpg';
const uploadIcon = '/assets/customer/icons/upload-icon.png';

/**
 * PetDetailPage — chuyển từ React: src/pages/Pet/PetDetailPage.jsx
 */
@Component({
  selector: 'div[app-pet-detail-page]',
  standalone: true,
  imports: [NgTemplateOutlet, ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './pet-detail-page.component.html',
  host: {
    'class': 'bg-transparent flex flex-col min-h-full font-sans',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetDetailPageComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly decisionModalService = inject(DecisionModalService);
  protected readonly petApi = inject(PetApiService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly uploadIcon: any = uploadIcon;
  protected readonly getFileUrl: any = getFileUrl;
  protected readonly isImageFile: any = isImageFile;
  protected readonly patternBg: any = patternBg;
  protected readonly getColorClass: any = getColorClass;
  protected readonly toPetSlug = toPetSlug; 

  // --- Giá trị tính toán (computed) ---
  readonly currentPetId = computed<any>(() => this.navService.params().id || this.navService.params().petId);
  readonly routeParamId = computed<any>(() => this.navService.params().id || this.navService.params().petId);
  readonly resolvedPetId = signal<string>('');
  readonly MAX_FILES = computed<any>(() => 3);
  readonly currentPetImage = computed<any>(() => this.pet()?.avatar || (this.pet()?.name ? (petImages as any)[this.pet().name] : lunaImg));
  readonly displayAge = computed<any>(() => formatAgeText(this.pet()?.age) || (this.pet()?.birthDate ? calculateAge(this.pet().birthDate) : "3 tuổi"));
  readonly year = computed<any>(() => this.calendarDate().getFullYear());
  readonly month = computed<any>(() => this.calendarDate().getMonth());
  readonly selectedDay = computed<any>(() => this.calendarDate().getDate());
  readonly today = computed<any>(() => new Date());
  readonly todayDay = computed<any>(() => this.today().getDate());
  readonly todayMonth = computed<any>(() => this.today().getMonth());
  readonly todayYear = computed<any>(() => this.today().getFullYear());
  readonly firstDayOfMonth = computed<any>(() => new Date(this.year(), this.month(), 1).getDay());
  readonly daysInMonth = computed<any>(() => new Date(this.year(), this.month() + 1, 0).getDate());
  readonly startOffset = computed<any>(() => this.firstDayOfMonth() === 0 ? 6 : Number(this.firstDayOfMonth()) - 1);
  readonly calendarDays = computed<any>(() => {
    const calendarDays: any = [];
    for (let i = 0; i < this.startOffset(); i++) {
        calendarDays.push({ date: null });
      }
    for (let i = 1; i <= this.daysInMonth(); i++) {
        const dayEvents = this.eventsList().filter((ev: any) => isEventInDate(ev, i, this.month(), this.year()));
        calendarDays.push({ 
          date: i, 
          isCurrent: i === this.todayDay() && this.month() === this.todayMonth() && this.year() === this.todayYear(), 
          isSelected: this.selectedDateObj()?.getDate() === i &&
            this.selectedDateObj()?.getMonth() === this.month() &&
            this.selectedDateObj()?.getFullYear() === this.year(),
          events: dayEvents.length > 0 ? dayEvents : null
        });
      }
    return calendarDays;
  });
  readonly defaultDateString = computed<any>(() => `${this.year()}-${String(this.month() + 1).padStart(2, '0')}-${String(this.selectedDay()).padStart(2, '0')}`);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly pet = signal<any>({});
  readonly petLoadError = signal<any>("");
  readonly calendarDate = signal<any>((() => new Date())());
  readonly eventsList = signal<any>(INITIAL_PET_EVENTS);
  // Bệnh án chỉ lấy từ API theo đúng pet_id, không dùng dữ liệu local/mock
  readonly medicalHistoryList = signal<any>([]);
  readonly showGeneralNoteModal = signal<any>(false);
  readonly showDayModal = signal<any>(false);
  readonly dayModalMode = signal<any>('view');
  readonly selectedDateObj = signal<any>((() => new Date())());
  readonly dayEventsData = signal<any>([]);
  readonly activeEventDetail = signal<any>(null);
  readonly showHistoryModal = signal<any>(false);
  readonly recordToDelete = signal<any>(null);
  readonly showAddMedicalModal = signal<any>(false);
  readonly medicalModalMode = signal<any>('create');
  readonly editingMedicalId = signal<any>(null);
  readonly newMedicalName = signal<any>("");
  readonly newMedicalDoctor = signal<any>("");
  readonly newMedicalDate = signal<any>("");
  readonly newMedicalNotes = signal<any>("");
  readonly newMedicalFile = signal<any>(null);
  readonly noteToDeleteId = signal<any>(null);
  readonly editingNoteId = signal<any>(null);
  readonly noteDate = signal<any>("");
  readonly noteTime = signal<any>("");
  readonly noteContent = signal<any>("");
  readonly selectedIcon = signal<any>("");
  readonly selectedColor = signal<any>("");
  readonly existingFiles = signal<any>([]);
  readonly markedDeletions = signal<any>([]);
  readonly isProfileHidden = signal<boolean>(false);

  constructor() {
    // useEffect(..., [currentPetId])
    effect((onCleanup: any) => {
      const slugOrId = this.routeParamId();
      const cleanup = untracked(() => {
        let active = true;
        this.pet.set({});
        this.medicalHistoryList.set([]);
        this.petLoadError.set("");
        this.resolvedPetId.set(String(slugOrId || ""));

        (async () => {
          let realPetId = String(slugOrId || "");
          const isDirectPetId =
            /^pet[_-]/i.test(realPetId) ||
            /^[0-9a-f]{24}$/i.test(realPetId) ||
            /^\d+$/.test(realPetId);

          if (realPetId && !isDirectPetId) {
            try {
              const myPets = await this.petApi.getMyPets();
              const matched = matchPetBySlugOrId(myPets, realPetId);
              if (matched) {
                realPetId = String(matched.id || matched.pet_id || matched._id || realPetId);
                if (active) this.pet.update((current: any) => ({ ...current, ...matched }));
              }
            } catch {
              // Không tải được danh sách -> thử gọi trực tiếp bằng giá trị trên URL
            }
          }

          if (!active || !realPetId) return;
          this.resolvedPetId.set(realPetId);

          const results = await Promise.allSettled([
            this.petApi.getPetDetails(realPetId),
            this.petApi.getMedicalRecordsByPet(realPetId),
            this.petApi.getHealthDiariesByPet(realPetId),
            this.petApi.getRemindersByPet(realPetId),
          ]);
          if (!active) return;

          const [petResult, recordsResult, diariesResult, remindersResult]: any = results;
          if (petResult.status === "fulfilled") {
            this.pet.update((current: any) => ({ ...current, ...petResult.value }));
          }
          if (recordsResult.status === "fulfilled") {
            this.medicalHistoryList.set(recordsResult.value || []);
          }
          if (diariesResult.status === "fulfilled" || remindersResult.status === "fulfilled") {
            const diaryEvents = diariesResult.status === "fulfilled" ? diariesResult.value : [];
            const reminderEvents = remindersResult.status === "fulfilled" ? remindersResult.value : [];
            const apiEvents = [...diaryEvents, ...reminderEvents];
            if (apiEvents.length) this.eventsList.set(apiEvents);
          }
          if (results.every((result: any) => result.status === "rejected")) {
            this.petLoadError.set("Không thể tải hồ sơ thú cưng. Vui lòng thử lại.");
          }
        })();

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [eventsList, selectedDateObj, showDayModal, month, year])
    effect((onCleanup: any) => {
      this.eventsList();
      this.selectedDateObj();
      this.showDayModal();
      this.month();
      this.year();
      const cleanup = untracked(() => {
        if (this.selectedDateObj() && this.showDayModal()) {
          const d = this.selectedDateObj().getDate();
          const m = this.selectedDateObj().getMonth();
          const y = this.selectedDateObj().getFullYear();
          const eventsInDay = this.eventsList().filter((ev: any) => isEventInDate(ev, d, m, y));
          this.dayEventsData.set(eventsInDay);

          if (this.activeEventDetail()) {
            const updatedActiveEvent = eventsInDay.find((ev: any) => ev.id === this.activeEventDetail().id);
            if (updatedActiveEvent) this.activeEventDetail.set(updatedActiveEvent);
          } else if (eventsInDay.length > 0) {
            this.activeEventDetail.set(eventsInDay[0]);
          }
        }
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected handleDateChange(e: any) {
    if (e.target.value) {
      this.calendarDate.set(new Date(e.target.value));
    }
  }

  protected handlePrevMonth() {
    return this.calendarDate.set(new Date(this.year(), Number(this.month()) - 1, this.selectedDay()));
  }

  protected handleNextMonth() {
    return this.calendarDate.set(new Date(this.year(), this.month() + 1, this.selectedDay()));
  }

  protected handleGoToToday() {
    return this.calendarDate.set(new Date());
  }

  protected handleOpenGeneralNoteModal() {
    this.noteDate.set("");
    this.noteTime.set("");
    this.noteContent.set("");
    this.selectedIcon.set("paw");
    this.selectedColor.set("blue");
    this.existingFiles.set([]);
    this.markedDeletions.set([]);
    this.showGeneralNoteModal.set(true);
  }

  protected async handleSaveGeneralNote(e: any) {
    e.preventDefault();
    if (!this.noteDate() || !this.noteContent() || !this.selectedIcon() || !this.selectedColor()) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    const targetDay = new Date(this.noteDate()).getDate();
    const targetDateKey = this.noteDate();
    const formattedTime = this.noteTime() ? formatTimeToSACH(this.noteTime()) : "--:--"; 
    const newEvent = {
      id: Date.now(), 
      day: targetDay,
      dateKey: targetDateKey,
      title: this.noteContent(),
      time: formattedTime,
      type: this.selectedColor(), 
      icon: this.selectedIcon(),
      files: this.existingFiles() 
    };
    try {
      const savedEvent = await this.petApi.createHealthDiary({
        petId: this.resolvedPetId(),
        entryDate: this.noteDate(),
        entryTime: this.noteTime() || null,
        title: this.noteContent(),
        content: this.noteContent(),
        icon: this.selectedIcon(),
        type: this.selectedColor(),
        files: getUploadFiles(this.existingFiles()),
      });
      this.eventsList.update((current: any) => [...current, { ...savedEvent, files: savedEvent.files?.length ? savedEvent.files : this.existingFiles() }]);
    } catch (error: any) {
      this.eventsList.update((current: any) => [...current, newEvent]);
    }
    this.showGeneralNoteModal.set(false);
  }

  protected handleOpenDayModal(day: any) {
    if(!day) return;
    const clickedDate = new Date(this.year(), this.month(), day);
    this.selectedDateObj.set(clickedDate);
    const eventsInDay = this.eventsList().filter((ev: any) => isEventInDate(ev, day, this.month(), this.year()));
    this.dayEventsData.set(eventsInDay);
    this.activeEventDetail.set(eventsInDay.length > 0 ? eventsInDay[0] : null);

    this.dayModalMode.set('view');
    this.showDayModal.set(true);
  }

  protected handleSelectDay(day: any) {
    if (!day) return;
    const selectedDate = new Date(this.year(), this.month(), day);
    this.selectedDateObj.set(selectedDate);
    this.dayEventsData.set(
      this.eventsList().filter((event: any) => isEventInDate(event, day, this.month(), this.year())),
    );
    this.activeEventDetail.set(null);
  }

  protected handleOpenSelectedDay() {
    const selectedDate = this.selectedDateObj() || this.calendarDate();
    this.handleOpenDayModal(selectedDate.getDate());
  }

  protected handleStartCreateNoteInDay() {
    this.editingNoteId.set(null);
    this.noteTime.set("");
    this.noteContent.set("");
    this.selectedIcon.set("paw");
    this.selectedColor.set("blue");
    this.existingFiles.set([]); 
    this.markedDeletions.set([]); 
    this.dayModalMode.set('create');
    this.activeEventDetail.set(null); 
  }

  protected handleStartEditingNote() {
    if (!this.activeEventDetail()) return;
    this.editingNoteId.set(this.activeEventDetail().id);
    this.noteTime.set(convertTimeToInputFormat(this.activeEventDetail().time));
    this.noteContent.set(this.activeEventDetail().title);
    this.selectedIcon.set(this.activeEventDetail().icon || 'paw');
    this.selectedColor.set(this.activeEventDetail().type || 'blue');
    this.existingFiles.set(this.activeEventDetail().files || []); 
    this.markedDeletions.set([]); 
    this.dayModalMode.set('edit');
  }

  protected async handleSaveDayNote(e: any) {
    e.preventDefault();
    if (!this.noteContent() || !this.selectedIcon() || !this.selectedColor()) {
      alert("Vui lòng điền nội dung, chọn biểu tượng và màu sắc!");
      return;
    }

    const targetDay = this.selectedDateObj().getDate();
    const targetDateKey = toDateKey(this.selectedDateObj());
    const formattedTime = this.noteTime() ? formatTimeToSACH(this.noteTime()) : "--:--"; 

    if (this.dayModalMode() === 'edit' && this.editingNoteId()) {
      const finalFiles = this.existingFiles().filter((file: any) => !this.markedDeletions().includes(file.id));
      if (this.activeEventDetail()?.sourceType === "diary") {
        try {
          const savedEvent = await this.petApi.updateHealthDiary(this.editingNoteId(), {
            petId: this.resolvedPetId(),
            entryDate: targetDateKey,
            entryTime: this.noteTime() || null,
            title: this.noteContent(),
            content: this.noteContent(),
            icon: this.selectedIcon(),
            type: this.selectedColor(),
            files: getUploadFiles(finalFiles),
          });
          this.eventsList.update((current: any) => current.map((event: any) =>
            event.id === this.editingNoteId() ? { ...event, ...savedEvent, files: savedEvent.files?.length ? savedEvent.files : finalFiles } : event,
          ));
          this.dayModalMode.set('view');
          return;
        } catch (error: any) {
          // Nếu API lỗi, tiếp tục cập nhật local để UI không bị kẹt.
        }
      }
      this.eventsList.update((prev: any) => prev.map((ev: any) => {
        if (ev.id === this.editingNoteId()) {
          return {
            ...ev,
            title: this.noteContent(),
            time: formattedTime,
            type: this.selectedColor(),
            icon: this.selectedIcon(),
            dateKey: ev.dateKey || targetDateKey,
            files: finalFiles 
          };
        }
        return ev;
      }));
    } else if (this.dayModalMode() === 'create') {
      const newEvent = {
        id: Date.now(), 
        day: targetDay,
        dateKey: targetDateKey,
        title: this.noteContent(),
        time: formattedTime,
        type: this.selectedColor(), 
        icon: this.selectedIcon(),
        files: this.existingFiles() 
      };
      try {
        const savedEvent = await this.petApi.createHealthDiary({
          petId: this.resolvedPetId(),
          entryDate: targetDateKey,
          entryTime: this.noteTime() || null,
          title: this.noteContent(),
          content: this.noteContent(),
          icon: this.selectedIcon(),
          type: this.selectedColor(),
          files: getUploadFiles(this.existingFiles()),
        });
        this.eventsList.update((current: any) => [...current, { ...savedEvent, files: savedEvent.files?.length ? savedEvent.files : this.existingFiles() }]);
      } catch (error: any) {
        this.eventsList.update((current: any) => [...current, newEvent]);
      }
    }
    this.dayModalMode.set('view'); 
  }

  protected handleDeleteNoteTrigger(id: any) {
    this.noteToDeleteId.set(id);
    this.decisionModalService.confirmDelete({
      message: "Bạn chắc chắn muốn xóa ghi chú lịch này?\nHành động này không thể hoàn tác",
      confirmLabel: "Xóa",
      onConfirm: () => this.handleConfirmDeleteNote(id),
    });
  }

  protected async handleConfirmDeleteNote(targetId: any = this.noteToDeleteId()) {
    const targetEvent = this.eventsList().find((event: any) => event.id === targetId);
    if (targetEvent?.sourceType === "diary") {
      try {
        await this.petApi.deleteHealthDiary(targetId);
      } catch (error: any) {
        // API lỗi thì vẫn xóa khỏi fallback local để UI không bị kẹt.
      }
    } else if (targetEvent?.sourceType === "reminder") {
      try {
        await this.petApi.deleteReminder(targetId);
      } catch (error: any) {
        // API lỗi thì vẫn xóa khỏi fallback local để UI không bị kẹt.
      }
    }

    this.eventsList.update((prev: any) => prev.filter((ev: any) => ev.id !== targetId));
    this.noteToDeleteId.set(null);
    if (this.activeEventDetail() && this.activeEventDetail().id === targetId) {
      this.activeEventDetail.set(null);
    }
    this.decisionModalService.showSuccessModal({
      message: "Đã xóa ghi chú lịch thành công.\nBạn có thể tiếp tục hoặc quay về trang chủ",
    });
  }

  protected handleOpenCreateMedical() {
    this.newMedicalName.set(""); this.newMedicalDoctor.set(""); this.newMedicalDate.set(""); this.newMedicalNotes.set("");
    this.newMedicalFile.set(null);
    this.medicalModalMode.set('create');
    this.editingMedicalId.set(null);
    this.showAddMedicalModal.set(true);
  }

  protected handleOpenEditMedical(record: any) {
    let formattedDateForInput = "";
    if (record.date && record.date !== "Chưa khám") {
      const parts = record.date.split("/");
      if (parts.length === 3) formattedDateForInput = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    this.newMedicalName.set(record.condition || record.name?.replace(".pdf", "") || "");
    this.newMedicalDoctor.set(record.doctor || "");
    this.newMedicalDate.set(formattedDateForInput);
    this.newMedicalNotes.set(record.notes || "");
    this.newMedicalFile.set(record.fileUrl ? {
      id: record.fileUrl,
      name: record.fileName || record.name || "Tài liệu đính kèm",
      size: record.size || "PDF",
      fileUrl: record.fileUrl,
      url: record.fileUrl,
    } : null);

    this.medicalModalMode.set('edit');
    this.editingMedicalId.set(record.id);
    this.showHistoryModal.set(false); 
    this.showAddMedicalModal.set(true);
  }

  protected async handleSaveMedicalRecord(e: any) {
    e.preventDefault();
    if (!this.newMedicalName() || !this.newMedicalDate()) {
      alert("Vui lòng nhập tên bệnh án và ngày khám!");
      return;
    }

    const [y, m, d] = this.newMedicalDate().split("-");
    const formattedDate = `${d}/${m}/${y}`;

    const payload = {
      petId: this.resolvedPetId(),
      condition: this.newMedicalName(),
      doctor: this.newMedicalDoctor(),
      visitDate: this.newMedicalDate(),
      notes: this.newMedicalNotes(),
      attachments: this.newMedicalFile()?.file ? [this.newMedicalFile().file] : [],
    };

    try {
      if (this.medicalModalMode() === 'edit' && this.editingMedicalId()) {
        const savedRecord = await this.petApi.updateMedicalRecord(this.editingMedicalId(), payload);
        this.medicalHistoryList.update((list: any[]) =>
          list.map((record: any) => record.id === this.editingMedicalId() ? { ...record, ...savedRecord } : record),
        );
      } else {
        const savedRecord = await this.petApi.createMedicalRecord(payload);
        this.medicalHistoryList.update((list: any[]) => [savedRecord, ...list]);
      }
    } catch (error: any) {
      alert(error?.message || "Không thể lưu bệnh án. Vui lòng thử lại.");
      return;
    }

    this.showAddMedicalModal.set(false);

    this.newMedicalName.set(""); this.newMedicalDoctor.set(""); this.newMedicalDate.set(""); this.newMedicalNotes.set("");
    this.newMedicalFile.set(null);
  }

  protected handleDeleteMedicalRecordTrigger(id: any) {
    this.recordToDelete.set(id);
    this.decisionModalService.confirmDelete({
      message: "Bạn chắc chắn muốn xóa bệnh án này?\nHành động này không thể hoàn tác",
      confirmLabel: "Xóa",
      onConfirm: () => this.handleConfirmDeleteMedicalRecord(id),
    });
  }

  protected async handleConfirmDeleteMedicalRecord(targetId: any = this.recordToDelete()) {
    try {
      await this.petApi.deleteMedicalRecord(targetId);
    } catch (error: any) {
      this.recordToDelete.set(null);
      alert(error?.message || "Không thể xóa bệnh án. Vui lòng thử lại.");
      return;
    }
    this.medicalHistoryList.update((list: any[]) => list.filter((r: any) => r.id !== targetId));
    this.recordToDelete.set(null);
    this.decisionModalService.showSuccessModal({
      message: "Đã xóa bệnh án thành công.\nBạn có thể tiếp tục hoặc quay về trang chủ",
    });
  }

  protected handleMedicalFileChange(event: any) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_UPLOAD_FILE_TYPES.includes(file.type)) {
      alert("Chỉ hỗ trợ file PDF, JPG hoặc PNG.");
      return;
    }
    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      alert("File không được vượt quá 10MB.");
      return;
    }
    this.newMedicalFile.set(createUploadedFile(file));
  }

  protected handleNoteFilesChange(event: any) {
    const selectedFiles = (Array.from(event.target.files || []) as any);
    event.target.value = "";
    if (!selectedFiles.length) return;

    const remainingSlots = Number(this.MAX_FILES()) - Number(this.calculateCurrentActiveFilesCount());
    if (remainingSlots <= 0) {
      alert(`Chỉ được tải tối đa ${this.MAX_FILES()} file.`);
      return;
    }

    const validFiles: any = [];
    for (const file of selectedFiles.slice(0, remainingSlots)) {
      if (!ACCEPTED_UPLOAD_FILE_TYPES.includes(file.type)) {
        alert("Chỉ hỗ trợ file PDF, JPG hoặc PNG.");
        continue;
      }
      if (file.size > MAX_UPLOAD_FILE_SIZE) {
        alert("File không được vượt quá 10MB.");
        continue;
      }
      validFiles.push(createUploadedFile(file));
    }

    if (selectedFiles.length > remainingSlots) {
      alert(`Chỉ được tải tối đa ${this.MAX_FILES()} file.`);
    }
    if (validFiles.length) {
      this.existingFiles.update((current: any) => [...current, ...validFiles]);
    }
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

  protected handleMarkFileDeletion(fileId: any) {
    if (!this.markedDeletions().includes(fileId)) this.markedDeletions.update((prev: any) => [...prev, fileId]);
  }

  protected handleUnmarkFileDeletion(fileId: any) {
    this.markedDeletions.update((prev: any) => prev.filter((id: any) => id !== fileId));
  }

  protected calculateCurrentActiveFilesCount() {
    return this.existingFiles().filter((file: any) => !this.markedDeletions().includes(file.id)).length;
  }

  /** (tự sinh) global String không dùng trực tiếp được trong template */
  protected compute1(): any {
    return String(this.selectedDateObj().getDate()).padStart(2, '0');
  }

  /** (tự sinh) global String không dùng trực tiếp được trong template */
  protected compute2(): any {
    return String(this.selectedDateObj().getMonth() + 1).padStart(2, '0');
  }

  protected handle3(ev: any) {
    this.activeEventDetail.set(ev);
    this.dayModalMode.set('view');
  }

  protected handle4() {
    if (this.dayModalMode() === 'edit') this.dayModalMode.set('view');
    else this.showDayModal.set(false);
  }

  protected handleToggleHideProfile() {
    const nextState = !this.isProfileHidden();
    this.isProfileHidden.set(nextState);

    // Nếu muốn gọi xác nhận qua DecisionModalService:
    /*
    this.decisionModalService.confirmDelete({
      message: nextState 
        ? "Bạn có chắc chắn muốn ẩn hồ sơ thú cưng này?" 
        : "Hiển thị lại hồ sơ thú cưng này?",
      confirmLabel: nextState ? "Ẩn hồ sơ" : "Hiển thị",
      onConfirm: () => this.isProfileHidden.set(nextState),
    });
    */
  }

    protected handleEditProfile() {
    const petData = {
      ...this.pet(),
      id: this.resolvedPetId() || this.pet()?.id || this.pet()?.pet_id || this.currentPetId(),
    };
    this.navService.navigate(`/thu-cung-cua-toi/${toPetSlug(petData)}/chinh-sua`);
  }

}
