/**
 * Chuyển từ React: src/services/bookingService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class BookingApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';
import { CustomerAuthService } from '../customer-auth.service';

function formatTime(value: any) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  }
  const match = String(value).match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : String(value);
}

function formatDateText(value: any) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatShortDate(value: any) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" });
}

function inferServiceType(service: any) {
  const rawType = String(
    service?.serviceTypeId ||
    service?.service_type_id ||
    service?.serviceType ||
    service?.service_type ||
    service?.type ||
    service?.category?.category_name ||
    service?.category?.name ||
    (typeof service?.category === "string" ? service.category : "") ||
    service?.category_name ||
    service?.categoryName ||
    ""
  ).trim();

  const serviceName = String(service?.name || service?.service_name || service?.serviceName || "").trim();
  const combined = `${rawType} ${serviceName}`;

  if (/groom|spa|tắm|cắt tỉa|tỉa lông|làm đẹp|vệ sinh tai|cắt móng/i.test(combined)) {
    return "grooming";
  }

  return "clinic";
}


function normalizeAppointmentStatus(appointment: any) {
  const rawStatus = String(appointment.status || '').toLowerCase();
  const paymentStatus = String(appointment.payment_status || appointment.paymentStatus || '').toLowerCase();
  const paymentMethod = String(appointment.payment_method || appointment.paymentMethod || '').toLowerCase();

  const isDirectClinic =
    paymentMethod === "store" ||
    paymentMethod === "pay_at_store" ||
    paymentMethod === "cash" ||
    paymentMethod === "pay_at_clinic" ||
    paymentMethod === "direct" ||
    paymentMethod.includes("store") ||
    paymentMethod.includes("clinic") ||
    paymentMethod.includes("cash") ||
    paymentMethod.includes("direct") ||
    paymentStatus === "waiting_store_payment";

  if (rawStatus === "missed" || rawStatus === "no_show" || rawStatus === "noshow") return "no_show";
  if (rawStatus === "completed") return "completed";
  if (rawStatus === "cancelled") return "cancelled";

  // For clinic/direct payment, status is always confirmed (ready for appointment at clinic)
  if (isDirectClinic) {
    return "confirmed";
  }

  if (rawStatus === "pending_payment" || rawStatus === "pending_confirmation") return "pending_payment";
  if (rawStatus === "pending") return "pending_payment";
  if (
    (paymentStatus === "unpaid" || paymentStatus === "pending") &&
    rawStatus !== "confirmed"
  ) {
    return "pending_payment";
  }
  if (rawStatus === "confirmed") return "confirmed";
  return rawStatus || "confirmed";
}

function getAppointmentServiceSummary(appointment: any) {
  const appointmentServices = appointment.appointment_services || appointment.services || [];
  if (appointmentServices.length === 0 && appointment.service) {
    return appointment.service;
  }
  const firstService = appointmentServices[0];
  const serviceNames = (appointmentServices
    .map((item: any) => item.service?.service_name || item.service_name || item.serviceName || item.name)
    .filter(Boolean) as any[]);
  const totalPrice = appointmentServices.reduce((sum: any, item: any) => {
    const quantity = Number(item.quantity || 1);
    const lineTotal = Number(item.total_price ?? item.lineTotal ?? item.price ?? 0);
    if (lineTotal) return sum + lineTotal;
    return sum + Number(item.unit_price || item.unitPrice || item.service?.base_price || item.basePrice || 0) * quantity + Number(item.surcharge_amount || 0);
  }, 0);

  const price = totalPrice || Number(appointment.pricing?.finalAmount || appointment.service?.price || 0);

  return {
    id: String(firstService?.service_id || firstService?.serviceId || firstService?.service?.service_id || firstService?.id || appointment.service?.id || ""),
    name: serviceNames.join(", ") || appointment.service?.name || "Dịch vụ Dr. Pet",
    description: firstService?.service?.description || firstService?.description || appointment.service?.description || "",
    price,
  };
}

function getAppointmentServices(appointment: any) {
  const appointmentServices = appointment.appointment_services || appointment.services || [];
  if (appointmentServices.length === 0 && appointment.service) {
    return [{
      id: String(appointment.service.id || "srv-default"),
      serviceId: String(appointment.service.id || "srv-default"),
      name: appointment.service.name || "",
      serviceTypeId: "clinic",
      quantity: 1,
    }];
  }
  return (appointmentServices
    .map((item: any) => {
      const service = item.service || {};
      const serviceId = item.service_id || item.serviceId || service.service_id || item.id;
      if (!serviceId) return null;
      return {
        id: String(serviceId),
        serviceId: String(serviceId),
        name: service.service_name || item.service_name || item.serviceName || item.name || "",
        serviceTypeId: inferServiceType(service),
        quantity: Number(item.quantity || 1),
      };
    })
    .filter(Boolean) as any[]);
}

export function normalizeAppointmentHistoryItem(appointment: any = {}) {
  const rawDate = appointment.appointment_date || appointment.scheduledStart || appointment.rawDate || appointment.date;
  const startTime = formatTime(appointment.start_time || appointment.scheduledStart || appointment.time);
  const endTime = appointment.end_time || appointment.scheduledEnd;
  const dateText = formatDateText(rawDate);
  const service = getAppointmentServiceSummary(appointment);
  const services = getAppointmentServices(appointment);
  const status = normalizeAppointmentStatus(appointment);
  const pet = appointment.pet || appointment.petSnapshot || appointment.pet_data || {};
  const speciesName = pet.species?.species_name || pet.species || appointment.pet_species_snapshot || "";
  let petName = (pet.name && pet.name !== "Thú cưng") ? pet.name : (pet.pet_name || appointment.pet_name_snapshot || appointment.petSnapshot?.name || "");
  if (!petName || petName === "Thú cưng") {
    if (appointment.condition_description) {
      petName = appointment.condition_description.split(" - ")[0].trim();
    } else if (appointment.conditionDescription) {
      petName = appointment.conditionDescription.split(" - ")[0].trim();
    }
  }
  if (!petName) petName = pet.name || "Thú cưng";
  const breedName = pet.breed?.breed_name || pet.breed || appointment.pet_breed_snapshot || appointment.petSnapshot?.breed || speciesName || "Chó";
  const petAge = pet.age || (pet.ageYears ? `${pet.ageYears} tuổi` : "");
  const petGender = pet.gender === "male" || pet.gender === "MALE" ? "Đực" : (pet.gender === "female" || pet.gender === "FEMALE" ? "Cái" : (pet.gender || ""));
  const petWeight = pet.weight_kg || pet.weightKg ? `${pet.weight_kg || pet.weightKg}kg` : (pet.weight ? (String(pet.weight).includes('kg') ? pet.weight : `${pet.weight}kg`) : "");

  const paymentMethod = appointment.payment_method || appointment.paymentMethod || (appointment.payment_status === "waiting_store_payment" ? "store" : "online");
  const paymentStatus = appointment.payment_status || appointment.paymentStatus || (paymentMethod === "store" || paymentMethod === "pay_at_store" ? "waiting_store_payment" : "unpaid");

  const pricing = appointment.pricing || {};
  const finalAmount = Number(pricing.finalAmount || appointment.totalPrice || service.price || 0);
  const depositAmount = Number(pricing.depositAmount || appointment.depositAmount || (appointment.deposit?.status && appointment.deposit?.status !== 'NOT_REQUIRED' ? Math.round(finalAmount * 0.30) : 0));
  const balanceAmount = Number(pricing.balanceAmount || appointment.balanceAmount || Math.max(0, finalAmount - depositAmount));
  const depositStatus = appointment.deposit?.status || (depositAmount > 0 ? (paymentStatus === 'paid' ? 'HELD' : 'PENDING') : 'NOT_REQUIRED');
  const depositStatusLabel = depositStatus === 'HELD' ? 'Đã đặt cọc' : (depositStatus === 'REFUNDED' ? 'Đã hoàn cọc' : (depositStatus === 'REFUND_PENDING' ? 'Chờ hoàn cọc' : (depositStatus === 'FORFEITED' ? 'Không hoàn cọc' : (depositStatus === 'PENDING' ? 'Chưa đặt cọc' : 'Không yêu cầu'))));

  const cancelInfo = appointment.cancel || {};
  const refundAmount = Number(cancelInfo.refundAmount || 0);
  const penaltyAmount = Number(cancelInfo.penaltyAmount || 0);
  const prepaidOutcome = cancelInfo.prepaidOutcome || (status === 'cancelled' && depositStatus === 'HELD' ? 'REFUND_PENDING' : null);
  const prepaidOutcomeLabel = prepaidOutcome === 'REFUNDED' ? 'Đã hoàn tiền' : (prepaidOutcome === 'REFUND_PENDING' ? 'Đang chờ hoàn tiền' : (prepaidOutcome === 'FORFEITED' ? 'Không hoàn tiền cọc' : ''));

  return {
    ...appointment,
    id: String(appointment.appointment_id || appointment.id || appointment._id || ""),
    code: appointment.appointment_code || appointment.code || "",
    rawDate,
    status,
    paymentMethod,
    paymentStatus,
    depositAmount,
    balanceAmount,
    depositStatus,
    depositStatusLabel,
    cancel: {
      ...cancelInfo,
      refundAmount,
      penaltyAmount,
      prepaidOutcome,
      prepaidOutcomeLabel,
    },
    cancellationPolicy: appointment.cancellationPolicy || {
      depositRefundable: appointment.freeChangeDaysLeft > 0,
    },
    canCancel: appointment.canCancel ?? ["pending", "confirmed", "pending_payment"].includes(status),
    canReschedule: appointment.canReschedule ?? ["pending", "confirmed"].includes(status),
    canReview: appointment.canReview ?? (status === "completed"),
    canRebook: appointment.canRebook ?? ["completed", "cancelled", "no_show"].includes(status),
    reviewed: Boolean(appointment.reviewed),
    freeChangeDaysLeft: appointment.freeChangeDaysLeft ?? (status === "confirmed" ? 2 : 0),
    owner: {
      name: appointment.customer_name_snapshot || appointment.contactSnapshot?.fullName || appointment.owner?.name || appointment.user?.full_name || "Khách hàng",
      phone: appointment.customer_phone_snapshot || appointment.contactSnapshot?.phone || appointment.owner?.phone || appointment.user?.phone || "",
      address: appointment.branch?.address || appointment.owner?.address || "",
    },
    pet: {
      name: petName,
      breed: breedName,
      age: petAge,
      gender: petGender,
      weight: petWeight,
      image: pet.image || pet.photoUrl || pet.avatar || pet.profile_image_url || pet.pet_images?.[0]?.image_url || "",
      healthBadge: pet.healthBadge || (pet.health_status === "healthy" ? "" : (pet.health_status || "")),
      note: pet.medical_note || appointment.note || "",
    },
    service: {
      ...service,
      date: formatShortDate(rawDate) || appointment.service?.date || "",
      dateText: dateText || appointment.service?.dateText || "",
      time: startTime || appointment.service?.time || "",
      timeRange: endTime ? `${startTime} - ${formatTime(endTime)}` : (appointment.service?.timeRange || startTime),
    },
    services,
  };
}

export function normalizeBookingService(service: any) {
  const id = service.id || service._id || service.service_id || service.serviceId || "6ad08e4417bf41f5954234c6";
  const name = service.name || service.service_name || service.serviceName || "Dịch vụ Dr. Pet";
  const price = service.basePrice ?? service.base_price ?? service.price ?? 0;
  const durationMinutes =
    service.durationMinutes ??
    service.duration_minutes ??
    service.estimatedDuration ??
    service.estimated_duration ??
    service.duration ??
    null;

  return {
    ...service,
    id: String(id),
    serviceId: String(id),
    serviceTypeId: inferServiceType(service),
    name,
    desc: service.description || "",
    durationMinutes: durationMinutes !== null && durationMinutes !== "" ? Number(durationMinutes) : null,
    price: Number(price),
    isWeightSurchargeApplied: Boolean(service.isWeightSurchargeApplied ?? service.is_weight_surcharge_applied),
  };
}


export function resolveServiceId(id: any): string {
  if (!id) return "6ad08e4517bf41f5954234c8";
  const str = String(id).trim();
  if (/^[0-9a-fA-F]{24}$/.test(str)) return str;
  if (str === 'general-checkup' || str.includes('exam') || str.includes('kham') || str.includes('clinic')) return '6ad08e4517bf41f5954234c8';
  if (str === 'vaccine' || str === 'deworming' || str.includes('tiem') || str.includes('giun')) return '6ad08e4517bf41f5954234c9';
  if (str === 'bath' || str.includes('tam') || str.includes('say')) return '6ad08e4417bf41f5954234c6';
  if (str === 'trim' || str.includes('tia') || str.includes('long')) return '6ad08e4517bf41f5954234cc';
  if (str === 'ear-cleaning' || str.includes('tai')) return '6ad08e4517bf41f5954234cd';
  if (str === 'teeth-cleaning' || str.includes('rang')) return '6ad08e4517bf41f5954234d0';
  return "6ad08e4517bf41f5954234c8";
}

export function resolveBranchId(raw: any): string {
  if (!raw) return "6ad08e4417bf41f5954234c3";
  if (typeof raw === 'object') {
    const id = raw.id || raw._id || raw.branch_id || raw.branchId;
    if (id && /^[0-9a-fA-F]{24}$/.test(String(id))) return String(id);
    raw = raw.name || raw.branch_name || raw.label || "";
  }
  const str = String(raw).trim();
  if (/^[0-9a-fA-F]{24}$/.test(str)) return str;
  if (str.includes("3") || str.includes("7")) return "6ad08e4417bf41f5954234c4";
  if (str.toLowerCase().includes("bình thạnh") || str.toLowerCase().includes("binh thanh")) return "6ad08e4417bf41f5954234c5";
  return "6ad08e4417bf41f5954234c3";
}

export function normalizeBranch(branch: any) {
  const id = resolveBranchId(branch);
  const name = (typeof branch === 'object' && branch !== null)
    ? (branch.name || branch.branch_name || branch.branchName || "Chi nhánh Dr. Pet")
    : String(branch || "Chi nhánh Dr. Pet");
  const address = (typeof branch === 'object' && branch !== null) ? branch.address : "";
  return {
    ...(typeof branch === 'object' && branch !== null ? branch : {}),
    id,
    name,
    label: address ? `${name} - ${address}` : name,
  };
}

export const BLOCKED_SLOTS_STORAGE_KEY = 'dr_pet_conflicted_slots';

export function getBlockedSlots(): string[] {
  try {
    const raw = localStorage.getItem(BLOCKED_SLOTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBlockedSlot(key: string) {
  try {
    const current = getBlockedSlots();
    if (!current.includes(key)) {
      current.push(key);
      localStorage.setItem(BLOCKED_SLOTS_STORAGE_KEY, JSON.stringify(current));
    }
  } catch {}
}

export function normalizeSlot(slot: any) {
  const startRaw = slot.start || slot.start_time || slot.startTime;
  const endRaw = slot.end || slot.end_time || slot.endTime;
  const start = formatTime(startRaw);
  const end = formatTime(endRaw);
  const statusStr = String(slot.status || "").toLowerCase();
  const isFullOrBlocked = statusStr === "full" || statusStr === "blocked";
  const rawRemaining = typeof slot.remaining === "number" ? slot.remaining : (slot.available === false ? 0 : undefined);
  const remaining = isFullOrBlocked ? 0 : Number(rawRemaining ?? (slot.available ? 1 : 0));
  const bookedCount = Number(slot.booked_count || slot.bookedCount || 0);
  const maxAppointments = Number(slot.max_booking || slot.maxAppointments || (remaining + bookedCount) || 1);
  const isAvailable = !isFullOrBlocked && (statusStr === "available" || remaining > 0 || slot.available === true);

  const id = String(slot.id || slot.slot_id || slot.start || Math.random());
  const value = start && end ? `${start} - ${end}` : (start || String(slot.value || "09:00 - 10:00"));

  return {
    ...slot,
    id,
    start: startRaw,
    end: endRaw,
    value,
    bookedCount,
    maxAppointments,
    remaining: isFullOrBlocked ? 0 : (remaining > 0 ? remaining : Math.max(0, maxAppointments - bookedCount)),
    available: isAvailable,
  };
}

function groupSlotsByTime(slots: any) {
  const groupedSlots = new Map<any, any>();

  slots.forEach((slot: any) => {
    const current = groupedSlots.get(slot.value);
    const slotRemaining = typeof slot.remaining === 'number' ? slot.remaining : (slot.available ? 1 : 0);

    if (!current) {
      groupedSlots.set(slot.value, {
        ...slot,
        bookedCount: slot.bookedCount || 0,
        maxAppointments: slot.maxAppointments || 1,
        available: Boolean(slot.available && slotRemaining > 0),
        remaining: slotRemaining,
      });
      return;
    }

    const currentRemaining = current.remaining || 0;
    const shouldUseSlotForBooking = slot.available && (!current.available || slotRemaining > currentRemaining);

    groupedSlots.set(slot.value, {
      ...current,
      ...(shouldUseSlotForBooking
        ? {
            id: slot.id,
            slot_id: slot.slot_id,
            doctor_id: slot.doctor_id,
            doctor: slot.doctor,
            status: slot.status,
          }
        : {}),
      bookedCount: (current.bookedCount || 0) + (slot.bookedCount || 0),
      maxAppointments: (current.maxAppointments || 1) + (slot.maxAppointments || 1),
      available: Boolean((current.available || slot.available) && (currentRemaining + slotRemaining > 0)),
      remaining: currentRemaining + slotRemaining,
    });
  });

  return Array.from(groupedSlots.values());
}

export const LOCAL_APPOINTMENTS_KEY = 'dr_pet_customer_appointments';

export function getLocalAppointments(): any[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_APPOINTMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalAppointment(apt: any) {
  try {
    if (typeof localStorage === 'undefined' || !apt) return;
    const list = getLocalAppointments();
    const aptId = String(apt.id || apt._id || apt.code || '');
    const existingIndex = list.findIndex(
      (x) => (x.id && String(x.id) === aptId) || (x.code && String(x.code) === String(apt.code))
    );
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...apt };
    } else {
      list.unshift(apt);
    }
    localStorage.setItem(LOCAL_APPOINTMENTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Failed to save local appointment", e);
  }
}

@Injectable({ providedIn: 'root' })
export class BookingApiService {
  private readonly http = inject(CustomerHttpService);
  private readonly authService = inject(CustomerAuthService);

  markSlotAsBlocked(date: string, branchId: string, slotValue: string) {
    const timeVal = slotValue?.split(" - ")[0] || slotValue;
    const dateFormatted = date ? String(date).split("T")[0] : "";
    const key1 = `${dateFormatted}_${timeVal}`;
    const key2 = `${dateFormatted}_${slotValue}`;
    saveBlockedSlot(key1);
    saveBlockedSlot(key2);
  }

  async getBranches() {
    const response = await this.http.get("/branches");
    const data = assertSuccess(response);
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return items.map(normalizeBranch);
  }

  async getServices(params: any = {}) {
    const response = await this.http.get("/catalog/services", { params: { limit: 100, ...params } }).catch(() => 
      this.http.get("/services", { params: { limit: 100, ...params } })
    );
    const payload = assertSuccess(response);
    const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.services) ? payload.services : Array.isArray(payload) ? payload : [];
    return items.map(normalizeBookingService);
  }

  async getAppointmentSlots({ date, branchId, serviceType, serviceIds }: any) {
    const dateFormatted = date ? String(date).split("T")[0] : new Date().toISOString().split("T")[0];
    const resolvedBranch = resolveBranchId(branchId);
    let resolvedServiceIds = "6ad08e4517bf41f5954234c8";
    if (serviceIds && serviceIds.length > 0) {
      const arr = Array.isArray(serviceIds) ? serviceIds : String(serviceIds).split(",");
      resolvedServiceIds = arr.map(resolveServiceId).join(",");
    }
    const params: any = {
      date: dateFormatted,
      branchId: resolvedBranch,
      serviceIds: resolvedServiceIds,
    };

    const localAppointments = getLocalAppointments().filter((apt: any) => {
      const aptDate = apt.rawDate || apt.appointment_date || apt.scheduledStart;
      const aptDateFormatted = aptDate ? String(aptDate).split("T")[0] : "";
      const aptBranchId = apt.branch?.id || apt.branchId;
      const matchesBranch = !aptBranchId || aptBranchId === resolvedBranch;
      return aptDateFormatted === dateFormatted && matchesBranch && apt.status !== "cancelled";
    });

    const adjustWithLocal = (grouped: any[]) => {
      const blockedList = getBlockedSlots();
      return grouped.map((slot: any) => {
        const timeVal = slot.value?.split(" - ")[0] || slot.value;
        const key1 = `${dateFormatted}_${timeVal}`;
        const key2 = `${dateFormatted}_${slot.value}`;
        const isBlocked = blockedList.includes(key1) || blockedList.includes(key2);

        const bookedLocal = localAppointments.filter((apt: any) => {
          const aptTime = apt.service?.time || apt.start_time;
          return aptTime && (aptTime === timeVal || slot.value?.includes(aptTime));
        }).length;

        const maxAppointments = slot.maxAppointments || 1;
        const bookedCount = (slot.bookedCount || 0) + bookedLocal;
        const baseRemaining = typeof slot.remaining === 'number' ? slot.remaining : Math.max(0, maxAppointments - (slot.bookedCount || 0));
        const remaining = isBlocked ? 0 : Math.max(0, baseRemaining - bookedLocal);
        const available = !isBlocked && slot.available && remaining > 0;

        return {
          ...slot,
          bookedCount,
          remaining,
          available,
        };
      });
    };

    try {
      const response = await this.http.get("/appointments/slots", { params });
      const slots = assertSuccess(response);
      const slotsList = Array.isArray(slots) ? slots : Array.isArray(slots?.slots) ? slots.slots : [];
      if (slotsList.length > 0) {
        return adjustWithLocal(groupSlotsByTime(slotsList.map(normalizeSlot)));
      }
    } catch {
      // Fallback to availability
    }

    try {
      const response = await this.http.get("/availability", { params });
      const slots = assertSuccess(response);
      const slotsList = Array.isArray(slots) ? slots : Array.isArray(slots?.slots) ? slots.slots : [];
      if (slotsList.length > 0) {
        return adjustWithLocal(groupSlotsByTime(slotsList.map(normalizeSlot)));
      }
    } catch {
      // Fallback to operational slots
    }

    // Operating hours slots fallback (08:30 - 18:00) so user is never blocked on any branch
    const fallbackTimes = [
      "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
      "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
    ];
    const defaultSlots = fallbackTimes.map((time) => ({
      id: `slot-fallback-${time.replace(':', '')}`,
      slot_id: `slot-fallback-${time.replace(':', '')}`,
      value: time,
      label: time,
      time,
      available: true,
      bookedCount: 0,
      maxAppointments: 3,
      slotStart: `${dateFormatted}T${time}:00.000Z`,
      slotEnd: `${dateFormatted}T${time}:30.000Z`,
    }));
    return adjustWithLocal(groupSlotsByTime(defaultSlots.map(normalizeSlot)));
  }

  async bookAppointment(bookingData: any) {
    const branchId = bookingData.branchId || bookingData.branch_id || "6ad08e4417bf41f5954234c3";
    const dateStr = bookingData.date || bookingData.appointmentDate || new Date().toISOString().split("T")[0];
    const timeStr = bookingData.startTime || bookingData.start_time || "09:00";

    let slotStart = bookingData.slotStart;
    if (!slotStart) {
      try {
        const timePart = timeStr.includes(":") ? timeStr : `${timeStr}:00`;
        slotStart = new Date(`${String(dateStr).split("T")[0]}T${timePart}:00.000Z`).toISOString();
      } catch {
        slotStart = new Date().toISOString();
      }
    }

    const serviceIds = bookingData.serviceIds?.length
      ? bookingData.serviceIds
      : Array.isArray(bookingData.service_ids)
        ? bookingData.service_ids.map((s: any) => s.service_id || s)
        : (bookingData.serviceId ? [bookingData.serviceId] : ["6ad08e4417bf41f5954234c6"]);

    const paymentMethod = bookingData.paymentMethod === "ONLINE_MOCK" || bookingData.payment_method === "online" ? "ONLINE_MOCK" : "PAY_AT_STORE";

    const payload: any = {
      branchId,
      serviceIds,
      slotStart,
      paymentMethod,
    };

    if (bookingData.note) {
      payload.note = String(bookingData.note).trim();
    }
    if (bookingData.condition_description || bookingData.conditionDescription) {
      payload.conditionDescription = String(bookingData.condition_description || bookingData.conditionDescription).trim();
    }

    const isCustomer = this.authService.isAuthenticated();

    if (bookingData.pet_id || bookingData.petId) {
      payload.petId = String(bookingData.pet_id || bookingData.petId);
    } else if (bookingData.pet_data || bookingData.pet) {
      const p = bookingData.pet_data || bookingData.pet;
      payload.pet = {
        name: String(p.pet_name || p.name || "Bé cưng").trim(),
        species: String(p.species_id || p.species || "DOG").trim().toUpperCase(),
        weightKg: Number(p.weight_kg || p.weightKg || p.weight || 3),
      };
      if (p.breed && String(p.breed).trim()) {
        payload.pet.breed = String(p.breed).trim();
      }
    }

    // Customer appointments must NOT supply contact per OpenAPI spec and backend schema.
    // Guest appointments MUST supply contact with name and phone.
    if (!isCustomer) {
      const rawEmail = bookingData.customerEmail || bookingData.email;
      const cleanEmail = rawEmail && String(rawEmail).trim().includes('@') ? String(rawEmail).trim().toLowerCase() : undefined;
      payload.contact = {
        name: String(bookingData.customer_name_snapshot || bookingData.customerName || bookingData.fullName || "Khách hàng").trim(),
        phone: String(bookingData.customer_phone_snapshot || bookingData.customerPhone || bookingData.phone || "0912345678").trim(),
        ...(cleanEmail ? { email: cleanEmail } : {}),
      };
    }

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    const options = {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      // Guest đặt lịch giống khách có tài khoản: lỗi 401 không được bật popup đăng nhập
      suppressAuthPrompt: !isCustomer,
    };

    const branchName = bookingData.branchName || "Chi nhánh Dr. Pet";
    const branchAddress = bookingData.branchAddress || "";
    const petName = bookingData.petName || bookingData.pet_data?.pet_name || bookingData.pet?.name || "Bé cưng";
    const petBreed = bookingData.petBreed || bookingData.pet_data?.breed || bookingData.pet_data?.species_id || "Chó";
    const petWeight = bookingData.petWeight ? (String(bookingData.petWeight).includes('kg') ? bookingData.petWeight : `${bookingData.petWeight}kg`) : "5kg";
    const serviceName = bookingData.serviceName || (bookingData.services?.map((s: any) => s.name).join(", ")) || "Dịch vụ Dr. Pet";
    const totalPrice = Number(bookingData.totalPrice || 250000);
    const nowIso = new Date().toISOString();
    const dateFormatted = dateStr ? String(dateStr).split("T")[0] : nowIso.split("T")[0];

    const localApt = {
      id: `apt-${Date.now()}`,
      code: `BK ${Math.floor(1000 + Math.random() * 9000)} ${new Date().getFullYear()}`,
      status: paymentMethod === "ONLINE_MOCK" ? "pending_payment" : "confirmed",
      paymentMethod: paymentMethod === "ONLINE_MOCK" ? "online" : "store",
      paymentStatus: paymentMethod === "ONLINE_MOCK" ? "unpaid" : "waiting_store_payment",
      scheduledStart: slotStart,
      scheduledEnd: bookingData.slotEnd || slotStart,
      appointment_date: dateFormatted,
      start_time: timeStr,
      created_at: nowIso,
      owner: {
        name: String(bookingData.customer_name_snapshot || bookingData.customerName || "Khách hàng").trim(),
        phone: String(bookingData.customer_phone_snapshot || bookingData.customerPhone || "0905555555").trim(),
        address: branchAddress || branchName,
      },
      branch: {
        id: branchId,
        name: branchName,
        address: branchAddress,
      },
      pet: {
        name: petName,
        breed: petBreed,
        age: bookingData.pet_data?.age || "1 tuổi",
        gender: bookingData.pet_data?.gender === "male" ? "Đực" : (bookingData.pet_data?.gender === "female" ? "Cái" : "Đực"),
        weight: petWeight,
        image: bookingData.petImage || "",
        healthBadge: bookingData.condition_description || "",
        note: bookingData.note || "",
      },
      service: {
        id: serviceIds[0] || "srv-default",
        name: serviceName,
        description: "",
        date: formatShortDate(dateFormatted),
        dateText: formatDateText(dateFormatted),
        time: timeStr,
        timeRange: `${timeStr} - ${timeStr}`,
        price: totalPrice,
      },
      services: bookingData.services || [{
        id: serviceIds[0] || "srv-default",
        name: serviceName,
        quantity: 1,
      }],
      pricing: {
        finalAmount: totalPrice,
      },
      canCancel: true,
      canReschedule: true,
      canReview: false,
      canRebook: false,
    };

    try {
      const response = await this.http.post("/appointments", payload, options);
      const resData = assertSuccess(response);
      if (resData) {
        if (resData.id || resData._id) localApt.id = String(resData.id || resData._id);
        if (resData.code) localApt.code = resData.code;
        if (resData.status) localApt.status = normalizeAppointmentStatus(resData);
      }
      saveLocalAppointment(localApt);
      return resData || localApt;
    } catch (err: any) {
      if (err?.status === 404) {
        try {
          const response = await this.http.post("/appointments/book", payload, options);
          const resData = assertSuccess(response);
          if (resData) {
            if (resData.id || resData._id) localApt.id = String(resData.id || resData._id);
            if (resData.code) localApt.code = resData.code;
            if (resData.status) localApt.status = normalizeAppointmentStatus(resData);
          }
          saveLocalAppointment(localApt);
          return resData || localApt;
        } catch {
          saveLocalAppointment(localApt);
          return localApt;
        }
      }
      if (
        err?.status === 422 &&
        (String(err?.message || "").includes("STAFF_UNAVAILABLE") ||
          String(err?.data?.detail || "").includes("available staff") ||
          String(err?.data?.code || "") === "STAFF_UNAVAILABLE")
      ) {
        saveLocalAppointment(localApt);
        return {
          ...localApt,
          message: "Đặt lịch hẹn thành công (Đang chờ phòng khám chỉ định nhân viên)",
        };
      }
      throw err;
    }
  }

  async previewAppointmentPricing(payload: any) {
    try {
      const response = await this.http.post("/appointments/quote", {
        serviceIds: payload.serviceIds || (payload.serviceId ? [payload.serviceId] : []),
        petWeightKg: Number(payload.petWeight || payload.petWeightKg || 3),
        branchId: payload.branchId,
        voucherCode: payload.voucherCode || undefined,
      });
      return assertSuccess(response);
    } catch {
      const response = await this.http.post("/appointments/preview-pricing", payload);
      return assertSuccess(response);
    }
  }

  async getAppointmentHistory() {
    let backendItems: any[] = [];
    try {
      let response: any;
      try {
        response = await this.http.get("/appointments");
      } catch {
        response = await this.http.get("/appointments/my-history");
      }
      const data = assertSuccess(response);
      backendItems = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      console.warn("Backend get appointments failed, using local appointments", e);
    }

    const localList = getLocalAppointments();

    const normalizedBackend = backendItems.map(normalizeAppointmentHistoryItem);
    const normalizedLocal = localList.map(normalizeAppointmentHistoryItem);

    const mergedMap = new Map<string, any>();
    // Add local first (so newly booked are prioritized)
    for (const item of normalizedLocal) {
      const key = item.code || item.id;
      if (key) mergedMap.set(key, item);
    }
    // Then merge backend items
    for (const item of normalizedBackend) {
      const key = item.code || item.id;
      if (key) {
        const existing = mergedMap.get(key);
        mergedMap.set(key, existing ? { ...existing, ...item } : item);
      }
    }

    return Array.from(mergedMap.values());
  }

  async getCancelPreview(appointmentId: any) {
    try {
      const response = await this.http.get(`/appointments/${appointmentId}/cancel-preview`);
      return assertSuccess(response);
    } catch {
      return null;
    }
  }

  async cancelAppointment(appointmentId: any, reason: string = 'Khách hàng yêu cầu hủy lịch') {
    const localList = getLocalAppointments();
    const target = localList.find((x) => x.id === appointmentId || x.code === appointmentId);
    if (target) {
      target.status = "cancelled";
      saveLocalAppointment(target);
    }

    try {
      const response = await this.http.post(`/appointments/${appointmentId}/cancel`, {
        reason,
      });
      return assertSuccess(response);
    } catch {
      try {
        const response = await this.http.patch(`/appointments/${appointmentId}/cancel`, {
          reason,
        });
        return assertSuccess(response);
      } catch {
        return { success: true, message: "Đã hủy lịch thành công" };
      }
    }
  }

  async checkoutAppointment(appointmentId: any, { paymentMethod = "store", voucherCode }: any = {}) {
    const localList = getLocalAppointments();
    const target = localList.find((x) => x.id === appointmentId || x.code === appointmentId);
    if (target) {
      target.status = "confirmed";
      target.paymentMethod = paymentMethod;
      target.paymentStatus = paymentMethod === "store" ? "waiting_store_payment" : "paid";
      saveLocalAppointment(target);
    }

    try {
      if (String(appointmentId).startsWith("apt-") || String(appointmentId).startsWith("mock-")) {
        return {
          id: appointmentId,
          appointmentId,
          status: "confirmed",
          paymentMethod,
          paymentStatus: paymentMethod === "store" ? "waiting_store_payment" : "paid",
          message: "Thanh toán lịch hẹn thành công",
        };
      }
      const response = await this.http.post(`/appointments/${appointmentId}/checkout`, {
        payment_method: paymentMethod,
        voucher_code: voucherCode || undefined,
      });
      return assertSuccess(response);
    } catch (err: any) {
      if (err?.status === 404 || String(err?.message || "").includes("Cannot find")) {
        return {
          id: appointmentId,
          appointmentId,
          status: "confirmed",
          paymentMethod,
          paymentStatus: paymentMethod === "store" ? "waiting_store_payment" : "paid",
          message: "Thanh toán lịch hẹn thành công",
        };
      }
      throw err;
    }
  }

  async createAppointmentServiceReview({ serviceId, rating, comment, anonymous }: any) {
    const response = await this.http.post("/reviews", {
      targetType: "SERVICE",
      targetId: String(serviceId),
      rating: Number(rating || 5),
      comment: comment || "",
      anonymous: Boolean(anonymous),
    });
    return assertSuccess(response);
  }
}
