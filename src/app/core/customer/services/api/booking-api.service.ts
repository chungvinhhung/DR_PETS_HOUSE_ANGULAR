/**
 * Chuyển từ React: src/services/bookingService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class BookingApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatShortDate(value: any) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" });
}

function inferServiceType(service: any) {
  const categoryName = service?.category?.category_name || "";
  if (/groom|spa/i.test(categoryName) || categoryName.includes("Grooming")) return "grooming";
  return "clinic";
}

function normalizeAppointmentStatus(appointment: any) {
  if (appointment.status === "missed") return "no_show";
  if (appointment.status === "pending" && (appointment.payment_status === "waiting_store_payment" || appointment.payment_method === "store")) {
    return "confirmed";
  }
  if (appointment.status === "pending") return "pending_payment";
  if (
    appointment.payment_status === "unpaid" &&
    appointment.payment_method !== "store" &&
    appointment.status !== "cancelled" &&
    appointment.status !== "completed"
  ) {
    return "pending_payment";
  }
  return appointment.status || "confirmed";
}

function getAppointmentServiceSummary(appointment: any) {
  const appointmentServices = appointment.appointment_services || appointment.services || [];
  const firstService = appointmentServices[0];
  const serviceNames = (appointmentServices
    .map((item: any) => item.service?.service_name || item.service_name)
    .filter(Boolean) as any[]);
  const totalPrice = appointmentServices.reduce((sum: any, item: any) => {
    const quantity = Number(item.quantity || 1);
    const lineTotal = Number(item.total_price ?? 0);
    if (lineTotal) return sum + lineTotal;
    return sum + Number(item.unit_price || item.service?.base_price || 0) * quantity + Number(item.surcharge_amount || 0);
  }, 0);

  return {
    id: String(firstService?.service_id || firstService?.service?.service_id || ""),
    name: serviceNames.join(", ") || "Dịch vụ",
    description: firstService?.service?.description || "",
    price: totalPrice,
  };
}

function getAppointmentServices(appointment: any) {
  const appointmentServices = appointment.appointment_services || appointment.services || [];
  return (appointmentServices
    .map((item: any) => {
      const service = item.service || {};
      const serviceId = item.service_id || service.service_id || item.id;
      if (!serviceId) return null;
      return {
        id: String(serviceId),
        serviceId: String(serviceId),
        name: service.service_name || item.service_name || item.name || "",
        serviceTypeId: inferServiceType(service),
        quantity: Number(item.quantity || 1),
      };
    })
    .filter(Boolean) as any[]);
}

export function normalizeAppointmentHistoryItem(appointment: any = {}) {
  const startTime = formatTime(appointment.start_time);
  const dateText = formatDateText(appointment.appointment_date);
  const service = getAppointmentServiceSummary(appointment);
  const services = getAppointmentServices(appointment);
  const status = normalizeAppointmentStatus(appointment);
  const pet = appointment.pet || {};
  const speciesName = pet.species?.species_name || appointment.pet_species_snapshot || "";

  return {
    ...appointment,
    id: String(appointment.appointment_id || appointment.id || ""),
    code: appointment.appointment_code || appointment.code || "",
    rawDate: appointment.appointment_date,
    status,
    paymentMethod: appointment.payment_method || (appointment.payment_status === "waiting_store_payment" ? "store" : "online"),
    paymentStatus: appointment.payment_status || "unpaid",
    canCancel: ["pending", "confirmed", "pending_payment"].includes(status),
    canReschedule: ["pending", "confirmed"].includes(status),
    canReview: status === "completed",
    canRebook: ["completed", "cancelled", "no_show"].includes(status),
    reviewed: false,
    freeChangeDaysLeft: 0,
    owner: {
      name: appointment.customer_name_snapshot || appointment.user?.full_name || "",
      phone: appointment.customer_phone_snapshot || appointment.user?.phone || "",
      address: appointment.branch?.address || "",
    },
    pet: {
      name: pet.pet_name || appointment.pet_name_snapshot || "Thú cưng",
      breed: pet.breed?.breed_name || appointment.pet_breed_snapshot || speciesName,
      age: pet.age || "",
      gender: pet.gender === "male" ? "Đực" : pet.gender === "female" ? "Cái" : "",
      weight: pet.weight_kg ? `${pet.weight_kg}kg` : "",
      image: pet.profile_image_url || pet.pet_images?.[0]?.image_url || "",
      healthBadge: pet.health_status === "healthy" ? "" : pet.health_status || "",
      note: pet.medical_note || appointment.note || "",
    },
    service: {
      ...service,
      date: formatShortDate(appointment.appointment_date),
      dateText,
      time: startTime,
      timeRange: appointment.end_time ? `${startTime} - ${formatTime(appointment.end_time)}` : startTime,
    },
    services,
  };
}

export function normalizeBookingService(service: any) {
  const id = service.id || service._id || service.service_id || service.serviceId || "6ad08e4417bf41f5954234c6";
  const name = service.name || service.service_name || service.serviceName || "Dịch vụ Dr. Pet";
  const price = service.basePrice ?? service.base_price ?? service.price ?? 0;
  return {
    ...service,
    id: String(id),
    serviceId: String(id),
    serviceTypeId: inferServiceType(service),
    name,
    desc: service.description || "",
    price: Number(price),
    isWeightSurchargeApplied: Boolean(service.isWeightSurchargeApplied ?? service.is_weight_surcharge_applied),
  };
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

export function normalizeSlot(slot: any) {
  const startRaw = slot.start || slot.start_time || slot.startTime;
  const endRaw = slot.end || slot.end_time || slot.endTime;
  const start = formatTime(startRaw);
  const end = formatTime(endRaw);
  const remaining = Number(slot.remaining ?? (slot.available ? 1 : 0));
  const bookedCount = Number(slot.booked_count || slot.bookedCount || 0);
  const maxAppointments = Number(slot.max_booking || slot.maxAppointments || (remaining + bookedCount) || 3);
  const isAvailable = slot.status === "available" || remaining > 0 || slot.available === true;

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
    remaining: remaining > 0 ? remaining : Math.max(0, maxAppointments - bookedCount),
    available: isAvailable,
  };
}

function groupSlotsByTime(slots: any) {
  const groupedSlots = new Map<any, any>();

  slots.forEach((slot: any) => {
    const current = groupedSlots.get(slot.value);
    const remaining = Math.max(0, slot.maxAppointments - slot.bookedCount);

    if (!current) {
      groupedSlots.set(slot.value, {
        ...slot,
        bookedCount: slot.bookedCount,
        maxAppointments: slot.maxAppointments,
        available: slot.available,
        remaining,
      });
      return;
    }

    const currentRemaining = Math.max(0, current.maxAppointments - current.bookedCount);
    const shouldUseSlotForBooking = slot.available && (!current.available || remaining > currentRemaining);

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
      bookedCount: current.bookedCount + slot.bookedCount,
      maxAppointments: current.maxAppointments + slot.maxAppointments,
      available: current.available || slot.available,
      remaining: current.remaining + remaining,
    });
  });

  return (Array.from(groupedSlots.values()) as any).map(({ remaining, ...slot }: any) => slot);
}

@Injectable({ providedIn: 'root' })
export class BookingApiService {
  private readonly http = inject(CustomerHttpService);

  async getBranches() {
    const response = await this.http.get("/branches", { params: { status: 'ACTIVE' } });
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
    const params: any = {
      date: dateFormatted,
      branchId: resolvedBranch,
      serviceIds: (serviceIds && serviceIds.length > 0)
        ? (Array.isArray(serviceIds) ? serviceIds.join(",") : serviceIds)
        : "6ad08e4417bf41f5954234c6",
    };
    try {
      const response = await this.http.get("/appointments/slots", { params });
      const slots = assertSuccess(response);
      const slotsList = Array.isArray(slots) ? slots : Array.isArray(slots?.slots) ? slots.slots : [];
      return groupSlotsByTime(slotsList.map(normalizeSlot));
    } catch {
      const response = await this.http.get("/availability", { params });
      const slots = assertSuccess(response);
      const slotsList = Array.isArray(slots) ? slots : Array.isArray(slots?.slots) ? slots.slots : [];
      return groupSlotsByTime(slotsList.map(normalizeSlot));
    }
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
      note: bookingData.note || undefined,
    };

    if (bookingData.pet_id || bookingData.petId) {
      payload.petId = bookingData.pet_id || bookingData.petId;
    } else {
      payload.contact = {
        fullName: bookingData.customer_name_snapshot || bookingData.customerName || bookingData.fullName || "Khách hàng",
        phone: bookingData.customer_phone_snapshot || bookingData.customerPhone || bookingData.phone || "0912345678",
        email: bookingData.customerEmail || bookingData.email || undefined,
      };
      if (bookingData.pet_data) {
        payload.pet = {
          name: bookingData.pet_data.pet_name || "Bé cưng",
          species: bookingData.pet_data.species_id || "DOG",
          breed: bookingData.pet_data.breed || undefined,
          weightKg: Number(bookingData.pet_data.weight_kg || 3),
        };
      }
    }

    try {
      const response = await this.http.post("/appointments", payload);
      return assertSuccess(response);
    } catch (err: any) {
      if (err?.status === 404) {
        const response = await this.http.post("/appointments/book", payload);
        return assertSuccess(response);
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
    const response = await this.http.get("/appointments/my-history");
    const data = assertSuccess(response);
    const appointmentsArray = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
    return appointmentsArray.map(normalizeAppointmentHistoryItem);
  }

  async cancelAppointment(appointmentId: any) {
    try {
      const response = await this.http.post(`/appointments/${appointmentId}/cancel`, {
        reason: 'Khách hàng yêu cầu hủy lịch'
      });
      return assertSuccess(response);
    } catch {
      const response = await this.http.patch(`/appointments/${appointmentId}/cancel`);
      return assertSuccess(response);
    }
  }

  async checkoutAppointment(appointmentId: any, { paymentMethod = "store", voucherCode }: any = {}) {
    const response = await this.http.post(`/appointments/${appointmentId}/checkout`, {
      payment_method: paymentMethod,
      voucher_code: voucherCode || undefined,
    });
    return assertSuccess(response);
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
