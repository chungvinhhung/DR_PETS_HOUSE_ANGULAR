/**
 * Chuyển từ React: src/services/petService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class PetApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';

function getPrimaryImage(pet: any = {}) {
  const primaryImage = Array.isArray(pet.pet_images)
    ? pet.pet_images.find((image: any) => image.is_primary) || pet.pet_images[0]
    : null;

  return pet.photoUrl || pet.profile_image_url || primaryImage?.image_url || null;
}

function formatDateText(value: any) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatTimeText(value: any) {
  if (!value) return "--:--";
  const match = String(value).match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : String(value);
}

export function normalizePet(pet: any = {}) {
  const healthStatusCode = pet.health_status ?? pet.healthStatusCode ?? pet.healthStatus ?? "unknown";
  const healthStatusMap = {
    healthy: "Bình thường",
    treating: "Đang điều trị",
    need_recheck: "Cần tái khám",
    unknown: "",
  };

  return {
    id: String(pet.pet_id ?? pet.petId ?? pet.id ?? pet._id ?? ""),
    pet_id: pet.pet_id ?? pet.petId ?? pet.id ?? pet._id,
    speciesId: pet.species_id ?? pet.speciesId ?? pet.species?.species_id ?? "",
    breedId: pet.breed_id ?? pet.breedId ?? pet.breed?.breed_id ?? "",
    name: pet.pet_name ?? pet.name ?? "",
    species: pet.species?.species_name ?? pet.species_name ?? pet.species ?? "",
    breed: pet.breed?.breed_name ?? pet.breed_name ?? pet.breed ?? "",
    age: pet.age ?? pet.ageYears ?? pet.age_years ?? "",
    gender: pet.gender ?? "",
    weight: pet.weight_kg ? `${pet.weight_kg} kg` : pet.weight ?? "",
    weightKg: pet.weight_kg ?? null,
    birthDate: pet.birth_date ?? pet.birthDate ?? "",
    healthStatusCode,
    healthStatus: (healthStatusMap as any)[healthStatusCode] || pet.healthStatus || healthStatusCode,
    medicalNotes: pet.medical_note ?? pet.medicalNotes ?? "",
    isHidden: Boolean(
      pet.is_hidden ??
        pet.isHidden ??
        (pet.is_active === false ||
          pet.isActive === false ||
          ["HIDDEN", "INACTIVE", "ARCHIVED"].includes(String(pet.status ?? "").toUpperCase())),
    ),
    lastCheckup: pet.latest_exam_date ?? pet.lastCheckup ?? null,
    avatar: getPrimaryImage(pet),
    medicalRecords: Array.isArray(pet.medicalRecords)
      ? pet.medicalRecords
      : Array.isArray(pet.medical_records)
        ? pet.medical_records.map(normalizeMedicalRecord)
        : [],
    raw: pet,
  };
}

export function normalizeMedicalRecord(record: any = {}) {
  const attachment = Array.isArray(record.attachments) ? record.attachments[0] : null;
  const condition = record.record_name || record.condition || record.diagnosis || "Bệnh án";

  return {
    ...record,
    id: String(record.record_id || record.id || Date.now()),
    name: record.name || `${condition}.pdf`,
    date: record.date || formatDateText(record.visit_date),
    condition,
    doctor: record.doctor?.full_name || record.doctor || "Chưa rõ",
    notes: record.notes || record.treatment_note || record.diagnosis || record.symptoms || "Không có ghi chú y tế.",
    fileUrl: attachment?.file_url || record.fileUrl || "",
    fileName: attachment?.file_name || record.fileName || record.name,
    sourceType: record.source_type,
  };
}

export function normalizeHealthDiary(diary: any = {}) {
  const entryDate = new Date(diary.entry_date || diary.date);
  const files = Array.isArray(diary.attachments)
    ? diary.attachments.map((attachment: any) => ({
        id: String(attachment.attachment_id || attachment.id || attachment.file_url),
        name: attachment.file_name || "Tệp đính kèm",
        url: attachment.file_url,
        fileUrl: attachment.file_url,
        size: attachment.file_size_kb ? `${attachment.file_size_kb} KB` : "",
        type: attachment.file_type,
      }))
    : diary.files || [];

  return {
    ...diary,
    id: String(diary.diary_entry_id || diary.diary_id || diary.id || Date.now()),
    sourceType: diary.sourceType || "diary",
    dateKey: Number.isNaN(entryDate.getTime()) ? diary.dateKey : entryDate.toISOString().slice(0, 10),
    day: Number.isNaN(entryDate.getTime()) ? diary.day : entryDate.getDate(),
    title: diary.title || diary.content || "Ghi chú",
    time: formatTimeText(diary.entry_time || diary.time),
    type: diary.color_code || diary.type || "blue",
    icon: diary.icon_code || diary.icon || "paw",
    files,
  };
}

export function normalizeReminder(reminder: any = {}) {
  const remindDate = new Date(reminder.remind_date || reminder.date);

  return {
    ...reminder,
    id: String(reminder.reminder_id || reminder.id || Date.now()),
    sourceType: "reminder",
    dateKey: Number.isNaN(remindDate.getTime()) ? reminder.dateKey : remindDate.toISOString().slice(0, 10),
    day: Number.isNaN(remindDate.getTime()) ? reminder.day : remindDate.getDate(),
    title: reminder.title || "Nhắc lịch",
    time: reminder.time || "--:--",
    type: reminder.color_code || reminder.type || "yellow",
    icon: reminder.icon_code || reminder.icon || "paw",
    notes: reminder.notes || reminder.note || "",
    status: reminder.status || "pending",
    files: [],
  };
}

function toPetPayload(pet: any = {}) {
  const healthStatusMap = {
    "Bình thường": "healthy",
    "Đang điều trị": "treating",
    "Có bệnh nền": "unknown",
    "Cần tái khám": "need_recheck",
  };

  return {
    pet_name: pet.name || pet.pet_name,
    species_id: pet.speciesId || pet.species_id,
    species_name: pet.species || pet.speciesName || pet.species_name || null,
    breed_id: pet.breedId || pet.breed_id || null,
    breed_name: pet.breed || pet.breedName || pet.breed_name || null,
    gender: pet.gender || "unknown",
    birth_date: pet.birthDate || pet.birth_date || null,
    age: pet.age || null,
    weight_kg: pet.weightKg || pet.weight_kg || null,
    health_status: (healthStatusMap as any)[pet.healthStatus] || pet.healthStatus || pet.health_status || "unknown",
    medical_note: pet.medicalNotes || pet.medical_note || null,
    profile_image_url: pet.avatar || pet.profile_image_url || null,
  };
}

function toMedicalRecordPayload(record: any = {}) {
  const payload = {
    pet_id: record.petId || record.pet_id,
    record_name: record.condition || record.record_name || record.name,
    visit_date: record.visitDate || record.visit_date,
    diagnosis: record.diagnosis || record.condition || "",
    treatment_note: record.notes || record.treatment_note || "",
    symptoms: record.symptoms || "",
  };

  const files = [
    ...(Array.isArray(record.attachments) ? record.attachments : []),
    ...(Array.isArray(record.files) ? record.files : []),
  ].filter((item: any) => item instanceof File);

  if (!files.length) return payload;

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]: any) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  files.forEach((file: any) => formData.append("attachments", file));
  return formData;
}

function toHealthDiaryPayload(diary: any = {}) {
  const payload = {
    pet_id: diary.petId || diary.pet_id,
    entry_date: diary.entryDate || diary.entry_date,
    entry_time: diary.entryTime || diary.entry_time || null,
    icon_code: diary.icon || diary.icon_code || null,
    color_code: diary.type || diary.color_code || null,
    title: diary.title || "Ghi chú",
    content: diary.content || diary.title || "",
  };

  const files = [
    ...(Array.isArray(diary.attachments) ? diary.attachments : []),
    ...(Array.isArray(diary.files) ? diary.files : []),
  ].filter((item: any) => item instanceof File);

  if (!files.length) return payload;

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]: any) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  files.forEach((file: any) => formData.append("attachments", file));
  return formData;
}

@Injectable({ providedIn: 'root' })
export class PetApiService {
  private readonly http = inject(CustomerHttpService);

  private resolveCustomerId(): string {
    try {
      const profileStr = localStorage.getItem('drPetUserProfile');
      if (profileStr) {
        const p = JSON.parse(profileStr);
        if (p.customerId || p.userId) return String(p.customerId || p.userId);
      }
    } catch {}
    return '';
  }

  async getMyPets(customerId?: string) {
    const cid = customerId || this.resolveCustomerId();
    if (cid) {
      try {
        const response = await this.http.get(`/customers/${cid}/pets`);
        const pets = assertSuccess(response);
        return (Array.isArray(pets) ? pets : []).map(normalizePet);
      } catch (err: any) {
        if (err?.status !== 404) console.warn('Customer pets API error:', err);
      }
    }
    const response = await this.http.get("/my-pets").catch(() => []);
    const data = assertSuccess(response);
    const petsArray = Array.isArray(data) ? data : (data && Array.isArray(data.pets) ? data.pets : []);
    return petsArray.map(normalizePet);
  }

  async getPetDetails(petId: any, customerId?: string) {
    const cid = customerId || this.resolveCustomerId();
    if (cid) {
      try {
        const response = await this.http.get(`/customers/${cid}/pets/${petId}`);
        return normalizePet(assertSuccess(response));
      } catch {}
    }
    const response = await this.http.get(`/pets/${petId}`);
    return normalizePet(assertSuccess(response));
  }

  async getPetSpecies() {
    const response = await this.http.get("/pets/species").catch(() => []);
    const species = assertSuccess(response);
    return Array.isArray(species) ? species : [];
  }

  async getPetBreeds(speciesId: any) {
    if (!speciesId) return [];
    const response = await this.http.get("/pets/breeds", {
      params: { species_id: speciesId },
    }).catch(() => []);
    const breeds = assertSuccess(response);
    return Array.isArray(breeds) ? breeds : [];
  }

  async createPet(pet: any, customerId?: string) {
    const cid = customerId || this.resolveCustomerId();
    const payload = {
      name: pet.name || pet.pet_name,
      species: (pet.species || pet.species_name || 'DOG').toUpperCase(),
      breed: pet.breed || pet.breed_name || '',
      gender: (pet.gender || 'UNKNOWN').toUpperCase(),
      ageYears: Number(pet.ageYears || pet.age || 0),
      weightKg: Number(pet.weightKg || pet.weight_kg || 0),
      healthStatus: pet.healthStatus || 'NORMAL',
      medicalNotes: pet.medicalNotes || pet.medical_note || '',
      photoUrl: pet.photoUrl || pet.avatar || pet.profile_image_url || null,
    };
    if (cid) {
      try {
        const response = await this.http.post(`/customers/${cid}/pets`, payload);
        return normalizePet(assertSuccess(response));
      } catch {}
    }
    const response = await this.http.post("/pets", toPetPayload(pet));
    return normalizePet(assertSuccess(response));
  }

  async updatePet(petId: any, pet: any) {
    const response = await this.http.put(`/pets/${petId}`, toPetPayload(pet));
    return normalizePet(assertSuccess(response));
  }

  async deletePet(petId: any) {
    const response = await this.http.delete(`/pets/${petId}`);
    return assertSuccess(response);
  }

  async getMedicalRecordsByPet(petId: any) {
    const response = await this.http.get(`/medical-records/pet/${petId}`);
    const records = assertSuccess(response);
    return Array.isArray(records) ? records.map(normalizeMedicalRecord) : [];
  }

  async createMedicalRecord(record: any) {
    const payload = toMedicalRecordPayload(record);
    const response = await this.http.post("/medical-records", payload, payload instanceof FormData ? {
      headers: { "Content-Type": "multipart/form-data" },
    } : undefined);
    return normalizeMedicalRecord(assertSuccess(response));
  }

  async updateMedicalRecord(recordId: any, record: any) {
    const payload = toMedicalRecordPayload(record);
    const response = await this.http.put(`/medical-records/${recordId}`, payload, payload instanceof FormData ? {
      headers: { "Content-Type": "multipart/form-data" },
    } : undefined);
    return normalizeMedicalRecord(assertSuccess(response));
  }

  async deleteMedicalRecord(recordId: any) {
    const response = await this.http.delete(`/medical-records/${recordId}`);
    return assertSuccess(response);
  }

  async getHealthDiariesByPet(petId: any, params: any = {}) {
    const response = await this.http.get(`/health-diaries/pet/${petId}`, { params });
    const diaries = assertSuccess(response);
    return Array.isArray(diaries) ? diaries.map(normalizeHealthDiary) : [];
  }

  async getRemindersByPet(petId: any) {
    const response = await this.http.get(`/reminders/pet/${petId}`);
    const reminders = assertSuccess(response);
    return Array.isArray(reminders) ? reminders.map(normalizeReminder) : [];
  }

  async createHealthDiary(diary: any) {
    const payload = toHealthDiaryPayload(diary);
    const response = await this.http.post("/health-diaries", payload, payload instanceof FormData ? {
      headers: { "Content-Type": "multipart/form-data" },
    } : undefined);
    return normalizeHealthDiary(assertSuccess(response));
  }

  async updateHealthDiary(diaryId: any, diary: any) {
    const payload = toHealthDiaryPayload(diary);
    const response = await this.http.put(`/health-diaries/${diaryId}`, payload, payload instanceof FormData ? {
      headers: { "Content-Type": "multipart/form-data" },
    } : undefined);
    return normalizeHealthDiary(assertSuccess(response));
  }

  async deleteHealthDiary(diaryId: any) {
    const response = await this.http.delete(`/health-diaries/${diaryId}`);
    return assertSuccess(response);
  }

  async createReminder(reminder: any) {
    const response = await this.http.post("/reminders", {
      pet_id: reminder.petId || reminder.pet_id,
      reminder_type: reminder.reminderType || reminder.reminder_type || "other",
      title: reminder.title || reminder.content || "Nhắc lịch",
      remind_date: reminder.remindDate || reminder.remind_date,
      remind_before_days: reminder.remindBeforeDays ?? reminder.remind_before_days ?? 0,
      repeat_type: reminder.repeatType || reminder.repeat_type || "none",
      notes: reminder.notes || reminder.content || "",
    });
    return normalizeReminder({
      ...assertSuccess(response),
      icon: reminder.icon,
      type: reminder.type,
      time: reminder.time,
    });
  }

  async completeReminder(reminderId: any) {
    const response = await this.http.patch(`/reminders/${reminderId}/complete`);
    return normalizeReminder(assertSuccess(response));
  }

  async deleteReminder(reminderId: any) {
    const response = await this.http.delete(`/reminders/${reminderId}`);
    return assertSuccess(response);
  }
}
