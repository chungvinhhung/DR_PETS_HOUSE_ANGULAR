/**
 * Chuyển từ React: src/services/rescueService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class RescueApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';
import { rescueImages } from '../../../../shared/customer/assets/rescue-images';

function getPrimaryImage(images: any = []) {
  if (!images || !images.length) return rescueImages.rescuePlaceholder;
  const first = images[0];
  if (typeof first === 'string') return first;
  return images.find((item: any) => item.is_primary)?.image_url || first?.image_url || rescueImages.rescuePlaceholder;
}

export function normalizeAdoptionPet(pet: any = {}) {
  const isAdopted = pet.status === "adopted" || pet.status === "ADOPTED";
  const state = isAdopted ? "adopted" : "waiting";
  const speciesLabel = pet.species === "DOG" ? "Chó" : pet.species === "CAT" ? "Mèo" : (pet.species || "Thú cưng");

  return {
    ...pet,
    id: String(pet.adoption_pet_id || pet._id || pet.id || pet.petCode || ""),
    name: pet.petName || pet.name || "Bạn nhỏ",
    image: getPrimaryImage(pet.images || pet.adoption_pet_images || []),
    state,
    ribbon: isAdopted ? "Đã có tổ ấm" : "Đang chờ nhận nuôi",
    description: pet.rescueStory || pet.description || pet.personality || "Một bạn nhỏ đang chờ được yêu thương và chăm sóc.",
    status: ([speciesLabel, pet.ageDescription || pet.age_text, pet.breed, pet.branchId?.name || pet.region].filter(Boolean) as any[]).join(" - ") || "Đang chờ nhận nuôi",
    need: pet.healthStatus || pet.adoption_conditions || "Cần một gia đình có thời gian chăm sóc và đồng hành lâu dài.",
  };
}

export function normalizeAdoptionRequest(request: any = {}) {
  const pet = request.adoption_pet || request.pet || {};
  const status = request.status || "pending";
  const statusLabels = {
    pending: "Đang chờ duyệt",
    approved: "Đã được chấp nhận",
    rejected: "Đã bị từ chối",
  };

  return {
    ...request,
    id: String(request.adoption_request_id || request.id || ""),
    petId: String(pet.adoption_pet_id || pet.id || request.adoption_pet_id || ""),
    petName: pet.name || "Bạn nhỏ",
    petImage: getPrimaryImage(pet.images || pet.adoption_pet_images || []),
    status,
    statusLabel: (statusLabels as any)[status] || status,
    submittedAt: request.created_at || request.createdAt || null,
    reason: request.reason || "",
  };
}

export function normalizeRescueStation(station: any = {}) {
  return {
    ...station,
    id: String(station.station_id || station.id || ""),
    name: station.station_name || "Trạm cứu hộ",
    image: rescueImages.partners.vawa,
    href: station.fanpage_url || station.donation_url || "#",
    region: station.address || "Việt Nam",
    address: station.address || "",
    description: [station.phone ? `Hotline: ${station.phone}` : "Đang cập nhật thông tin liên hệ."],
    phone: station.phone || "",
  };
}

@Injectable({ providedIn: 'root' })
export class RescueApiService {
  private readonly http = inject(CustomerHttpService);

  async getAdoptionPets() {
    try {
      const response = await this.http.get("/adoptions/pets");
      const data = assertSuccess(response);
      const list = Array.isArray(data) ? data : (data?.items || data?.pets || []);
      return list.map(normalizeAdoptionPet);
    } catch {
      return [];
    }
  }

  async getRescueStations() {
    try {
      const response = await this.http.get("/rescue/stations");
      const data = assertSuccess(response);
      const list = Array.isArray(data) ? data : (data?.items || []);
      return list.map(normalizeRescueStation);
    } catch {
      return [];
    }
  }

  async createAdoptionRequest(petId: any, values: any) {
    const response = await this.http.post("/adoptions/requests", {
      rescuePetId: petId,
      adoption_pet_id: petId,
      petId,
      fullName: values.fullName,
      full_name: values.fullName,
      phone: values.phone,
      email: values.email || 'customer@example.com',
      gender: values.gender,
      birthYear: values.birthYear,
      birth_year: values.birthYear,
      address: values.address,
      housingType: values.housingType || 'HOUSE',
      housing_type: values.housingType || 'HOUSE',
      hasPetExperience: values.hasPetExperience ?? true,
      has_pet_experience: values.hasPetExperience ?? true,
      message: values.message || values.reason || values.adoptionReason || values.futurePlan || '',
      reason: values.adoptionReason || values.futurePlan || values.message || values.reason || "Mong muốn nhận nuôi và chăm sóc thú cưng.",
      housing_info: ([
        values.housingType && `Nhà ở: ${values.housingType}`,
        values.familyConsent && `Gia đình đồng ý: ${values.familyConsent}`,
        values.currentPets && `Thú cưng hiện tại: ${values.currentPets}`,
        values.aloneTime && `Thời gian ở một mình: ${values.aloneTime}`,
      ].filter(Boolean) as any[]).join("\n"),
      experience: values.futurePlan || values.currentPets || null,
    });
    return assertSuccess(response);
  }

  async getMyAdoptionRequests() {
    const response = await this.http.get("/adoptions/my-requests");
    const requests = assertSuccess(response);
    return Array.isArray(requests) ? requests.map(normalizeAdoptionRequest) : [];
  }
}
