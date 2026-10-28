/**
 * Chuyển từ React: src/services/bookingService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class BookingApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService } from '../customer-http.service';

function assertSuccess(response: any) {
  if (response?.EC !== undefined && response.EC !== 0) {
    throw new Error(response.EM || "Yeu cau dat lich khong thanh cong");
  }
  return response?.DT ?? response;
}

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
  return {
    ...service,
    id: String(service.service_id),
    serviceId: String(service.service_id),
    serviceTypeId: inferServiceType(service),
    name: service.service_name,
    desc: service.description || "",
    price: Number(service.base_price || 0),
    isWeightSurchargeApplied: Boolean(service.is_weight_surcharge_applied),
  };
}

export function normalizeBranch(branch: any) {
  return {
    ...branch,
    id: String(branch.branch_id),
    label: branch.branch_name ? `${branch.branch_name} - ${branch.address}` : branch.address,
  };
}

export function normalizeSlot(slot: any) {
  const start = formatTime(slot.start_time);
  const end = formatTime(slot.end_time);
  const bookedCount = Number(slot.booked_count || 0);
  const maxAppointments = Number(slot.max_booking || 1);

  return {
    ...slot,
    id: String(slot.slot_id),
    value: `${start} - ${end}`,
    bookedCount,
    maxAppointments,
    available: slot.status === "available" && bookedCount < maxAppointments,
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
    const response = await this.http.get("/branches");
    return assertSuccess(response).map(normalizeBranch);
  }

  async getServices(params: any = {}) {
    const response = await this.http.get("/services", { params: { limit: 100, ...params } });
    const payload = assertSuccess(response);
    return (payload?.services || payload || []).map(normalizeBookingService);
  }

  async getAppointmentSlots({ date, branchId, serviceType }: any) {
    const response = await this.http.get("/appointments/slots", {
      params: {
        date,
        branch_id: branchId || undefined,
        service_type: serviceType === "grooming" ? "grooming" : "exam",
      },
    });
    return groupSlotsByTime(assertSuccess(response).map(normalizeSlot));
  }

  async bookAppointment(payload: any) {
    const response = await this.http.post("/appointments/book", payload);
    return assertSuccess(response);
  }

  async previewAppointmentPricing(payload: any) {
    const response = await this.http.post("/appointments/preview-pricing", payload);
    return assertSuccess(response);
  }

  async getAppointmentHistory() {
    const response = await this.http.get("/appointments/my-history");
    const data = assertSuccess(response);
    const appointmentsArray = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
    return appointmentsArray.map(normalizeAppointmentHistoryItem);
  }

  async cancelAppointment(appointmentId: any) {
    const response = await this.http.patch(`/appointments/${appointmentId}/cancel`);
    return assertSuccess(response);
  }

  async checkoutAppointment(appointmentId: any, { paymentMethod = "store", voucherCode }: any = {}) {
    const response = await this.http.post(`/appointments/${appointmentId}/checkout`, {
      payment_method: paymentMethod,
      voucher_code: voucherCode || undefined,
    });
    return assertSuccess(response);
  }

  async createAppointmentServiceReview({ serviceId, rating, comment }: any) {
    const response = await this.http.post("/reviews", {
      target_type: "service",
      target_id: String(serviceId),
      rating,
      comment: comment || "",
    });
    return assertSuccess(response);
  }
}
