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
import { RESCUE_PARTNERS } from '../../../../features/customer/rescue/data/rescue-data';

function getPrimaryImage(images: any = []) {
  if (!images || !images.length) return rescueImages.rescuePlaceholder;
  const first = images[0];
  if (typeof first === 'string') return first;
  return images.find((item: any) => item.is_primary)?.image_url || first?.image_url || rescueImages.rescuePlaceholder;
}

export function normalizeAdoptionPet(pet: any = {}) {
  const isAdopted=String(pet.status||'').toUpperCase()==='ADOPTED';
  const partnerId=String(pet.supportPartnerId||'').trim();
  // Only route to a known partner in the existing public partner network.
  // Never redirect an unmatched pet to Dr. Pet or an arbitrary other rescue.
  const partner=RESCUE_PARTNERS.find(item=>item.id===partnerId);
  return {
    ...pet,
    id:String(pet._id||pet.adoption_pet_id||pet.id||pet.petCode||''),
    name:String(pet.petName||pet.name||'Bạn nhỏ'),
    image:getPrimaryImage(pet.images||pet.adoption_pet_images||[]),
    state:isAdopted?'adopted':'waiting',
    ribbon:isAdopted?'ĐÃ CÓ TỔ ẤM':'CÒN CHỜ',
    description:String(pet.rescueStory||pet.description||''),
    status:String(pet.healthStatus||''),
    need:String(pet.supportNeeds||''),
    supportPartnerId:partner?.id||'',
    supportPartnerName:partner?.name||'',
    supportPartnerHref:partner?.href||'',
  };
}

export function normalizeAdoptionRequest(request: any = {}) {
  // My-requests GET populates rescuePetId, but POST can return an unpopulated
  // ObjectId. Keep the selected Customer pet details for the immediate card.
  const linkedPet=request.rescuePetId;
  const pet=linkedPet && typeof linkedPet==='object' &&
    (linkedPet.petName || linkedPet.name)
      ? linkedPet
      : (request.adoption_pet || request.pet || {});
  const linkedPetId=typeof linkedPet==='string'?linkedPet
    : String(linkedPet?._id||linkedPet?.id||'');
  const status = String(request.status || 'PENDING').toLowerCase();
  const statusLabels: Record<string,string> = {
    pending: 'Đang chờ duyệt',
    approved: 'Đã được chấp nhận',
    rejected: 'Đã bị từ chối',
    cancelled: 'Đã hủy',
  };
  return {
    ...request,
    id:String(request._id || request.adoption_request_id || request.id || ''),
    petId:String(linkedPetId || pet._id || pet.adoption_pet_id || pet.id || request.adoption_pet_id || ''),
    petName:pet.petName || pet.name || 'Bạn nhỏ',
    petImage:getPrimaryImage(pet.images || pet.adoption_pet_images || []),
    status,
    statusLabel:statusLabels[status] || status,
    submittedAt:request.createdAt || request.created_at || null,
    reason:request.applicantInfo?.message || request.reason || '',
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
    // Read all official BE pages (not the old static sample or first 100 only).
    // Keep API failures visible to Customer rather than silently hiding them.
    const results:any[]=[];
    let page=1;
    let pages=1;
    do {
      const response=await this.http.get('/adoptions/pets',{params:{page,limit:100}});
      const data=assertSuccess(response);
      const items=Array.isArray(data)?data:(data?.items || data?.pets || []);
      if(!Array.isArray(items))throw new Error('Dữ liệu thú cưng cứu trợ không hợp lệ.');
      results.push(...items);
      const reported=Number(data?.totalPages);
      const total=Number(data?.total ?? data?.totalRows);
      pages=Number.isFinite(reported)&&reported>0?reported:
        Number.isFinite(total)&&total>0?Math.ceil(total/100):1;
      page+=1;
    } while(page<=Math.min(100,pages));
    return results.map(normalizeAdoptionPet);
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
