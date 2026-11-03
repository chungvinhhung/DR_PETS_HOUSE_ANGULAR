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
  const status = String(appointment.status || '').toUpperCase();
  if (status === 'PENDING_PAYMENT' || status === 'PENDING') return 'pending_payment';
  if (status === 'PENDING_CONFIRMATION' || status === 'CONFIRMED') return 'confirmed';
  if (status === 'IN_PROGRESS') return 'confirmed';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'NO_SHOW' || status === 'MISSED') return 'no_show';
  return String(appointment.status || 'confirmed').toLowerCase();
}

function getAppointmentServiceSummary(appointment: any) {
  const appointmentServices = appointment.appointment_services || appointment.services || [];
  const firstService = appointmentServices[0];
  const serviceNames = (appointmentServices
    .map((item: any) => item.service?.service_name || item.service_name || item.serviceName || item.name)
    .filter(Boolean) as any[]);
  const totalPrice = appointmentServices.reduce((sum: any, item: any) => {
    const quantity = Number(item.quantity || 1);
    const lineTotal = Number(item.total_price ?? 0);
    if (lineTotal) return sum + lineTotal;
    return sum + Number(item.unitPrice ?? item.unit_price ?? item.service?.base_price ?? 0) * quantity + Number(item.surcharge_amount || 0);
  }, 0);

  return {
    id: String(firstService?.serviceId || firstService?.service_id || firstService?.service?.service_id || ""),
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
      const serviceId = item.serviceId || item.service_id || service.service_id || item.id;
      if (!serviceId) return null;
      return {
        id: String(serviceId),
        serviceId: String(serviceId),
        name: service.service_name || item.serviceName || item.service_name || item.name || "",
        serviceTypeId: String(item.serviceType || service.serviceType || '').toUpperCase() === 'GROOMING' ? 'grooming' : inferServiceType(service),
        quantity: Number(item.quantity || 1),
      };
    })
    .filter(Boolean) as any[]);
}

export function normalizeAppointmentHistoryItem(appointment: any = {}) {
  const scheduledStart = appointment.scheduledStart || appointment.appointment_date || appointment.start_time;
  const scheduledEnd = appointment.scheduledEnd || appointment.end_time;
  const startTime = formatTime(scheduledStart);
  const dateText = formatDateText(scheduledStart);
  const service = getAppointmentServiceSummary(appointment);
  const services = getAppointmentServices(appointment);
  const status = normalizeAppointmentStatus(appointment);
  const pet = appointment.pet || appointment.petSnapshot || {};
  const contact = appointment.contactSnapshot || appointment.customerSnapshot || {};
  const speciesName = pet.species?.species_name || pet.species || appointment.pet_species_snapshot || "";
  const paymentMethodRaw = String(appointment.paymentMethod || appointment.payment_method || '').toUpperCase();
  const paymentMethod = paymentMethodRaw === 'PAY_AT_STORE' || paymentMethodRaw === 'STORE' ? 'store' : 'online';
  const paidAmount = Number(appointment.pricing?.paidAmount ?? appointment.paid_amount ?? 0);
  const finalAmount = Number(appointment.pricing?.finalAmount ?? appointment.total_amount ?? service.price ?? 0);
  const allowedActions = Array.isArray(appointment.allowedActions) ? appointment.allowedActions : [];

  return {
    ...appointment,
    id: String(appointment.id || appointment.appointment_id || appointment._id || ""),
    code: appointment.code || appointment.appointment_code || "",
    rawDate: scheduledStart,
    status,
    paymentMethod,
    paymentStatus: paidAmount >= finalAmount && finalAmount > 0 ? 'paid' : status === 'pending_payment' ? 'unpaid' : paidAmount > 0 ? 'paid' : 'unpaid',
    paymentExpiresAt: appointment.holdExpiresAt || appointment.payment_expires_at || null,
    canCancel: allowedActions.length ? allowedActions.includes('CANCEL') : ["pending_payment","confirmed"].includes(status),
    canReschedule: allowedActions.length ? allowedActions.includes('RESCHEDULE') : status === "confirmed",
    canReview: status === "completed",
    canRebook: ["completed","cancelled","no_show"].includes(status),
    reviewed: false,
    freeChangeDaysLeft: 0,
    owner: {
      name: contact.name || contact.fullName || appointment.customer_name_snapshot || appointment.user?.full_name || "",
      phone: contact.phone || appointment.customer_phone_snapshot || appointment.user?.phone || "",
      address: appointment.branch?.address || "",
    },
    pet: {
      name: pet.name || pet.petName || pet.pet_name || appointment.pet_name_snapshot || "Thú cưng",
      breed: pet.breed?.breed_name || pet.breed || appointment.pet_breed_snapshot || speciesName,
      age: pet.age || "",
      gender: ['male','MALE'].includes(pet.gender) ? "Đực" : ['female','FEMALE'].includes(pet.gender) ? "Cái" : pet.gender || "",
      weight: (pet.weightKg ?? pet.weight_kg) ? `${pet.weightKg ?? pet.weight_kg}kg` : "",
      image: pet.profileImageUrl || pet.profile_image_url || pet.pet_images?.[0]?.image_url || "",
      healthBadge: pet.healthStatus || pet.health_status || "",
      note: pet.medicalNote || pet.medical_note || appointment.note || "",
    },
    service: {
      ...service,
      price: finalAmount || service.price,
      date: formatShortDate(scheduledStart),
      dateText,
      time: startTime,
      timeRange: scheduledEnd ? `${startTime} - ${formatTime(scheduledEnd)}` : startTime,
    },
    services,
  };
}

export function normalizeBookingService(service: any) {
  const id = service.id ?? service.service_id ?? service._id;
  const serviceType = String(service.serviceType ?? service.service_type ?? '').toUpperCase();
  return {
    ...service,
    id: String(id ?? ''),
    serviceId: String(id ?? ''),
    serviceTypeId: serviceType === 'GROOMING' ? 'grooming' : inferServiceType(service),
    name: service.name ?? service.service_name ?? '',
    desc: service.description || "",
    price: Number(service.basePrice ?? service.base_price ?? 0),
    bookingMode: service.bookingMode ?? service.booking_mode ?? 'BOOKABLE',
    requiredStaffRole: service.requiredStaffRole ?? service.required_staff_role ?? '',
    durationMinutes: Number(service.durationMinutes ?? service.duration_minutes ?? 0),
    isWeightSurchargeApplied: Boolean(service.is_weight_surcharge_applied),
  };
}

export function normalizeBranch(branch: any) {
  const id = branch.id ?? branch.branch_id ?? branch._id;
  const name = branch.name ?? branch.branch_name ?? '';
  return {
    ...branch,
    id: String(id ?? ''),
    label: name ? `${name}${branch.address ? ' - ' + branch.address : ''}` : (branch.address || ''),
  };
}

export function normalizeSlot(slot: any) {
  const rawStart = slot.start ?? slot.start_time;
  const rawEnd = slot.end ?? slot.end_time;
  const start = formatTime(rawStart);
  const end = formatTime(rawEnd);
  const bookedCount = Number(slot.occupiedCount ?? slot.bookedCount ?? slot.booked_count ?? 0);
  const maxAppointments = Number(slot.totalCount ?? slot.max_booking ?? 1);
  const canonicalStatus = String(slot.status || '').toUpperCase();
  const available = canonicalStatus
    ? canonicalStatus === 'AVAILABLE' && Number(slot.remaining ?? (maxAppointments - bookedCount)) > 0
    : bookedCount < maxAppointments;

  return {
    ...slot,
    id: String(rawStart ?? slot.slot_id ?? ''),
    start: rawStart,
    end: rawEnd,
    value: `${start} - ${end}`,
    bookedCount,
    maxAppointments,
    remaining: Number(slot.remaining ?? Math.max(0, maxAppointments - bookedCount)),
    available,
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
    const response = await this.http.get("/branches", { params: { limit: 100 } });
    const payload = assertSuccess(response);
    const items = Array.isArray(payload) ? payload : (payload?.items || []);
    return items.map(normalizeBranch);
  }

  async getServices(params: any = {}) {
    const response = await this.http.get("/services", { params: { limit: 100, ...params } });
    const payload = assertSuccess(response);
    const items = Array.isArray(payload) ? payload : (payload?.items || payload?.services || []);
    return items.map(normalizeBookingService);
  }

  async getAppointmentSlots({ date, branchId, serviceIds }: any) {
    const ids = (Array.isArray(serviceIds) ? serviceIds : [serviceIds]).filter(Boolean);
    if (!date || !branchId || !ids.length) return [];
    const response = await this.http.get("/appointments/slots", {
      params: {
        date,
        branchId,
        serviceIds: ids.join(','),
      },
    });
    const payload = assertSuccess(response);
    const slots = Array.isArray(payload) ? payload : (payload?.slots || []);
    return slots.map(normalizeSlot);
  }

  async bookAppointment(payload: any) {
    const key = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `appointment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await this.http.post("/appointments", payload, {
      headers: { 'Idempotency-Key': key },
    });
    return assertSuccess(response);
  }

  async previewAppointmentPricing(payload: any) {
    const response = await this.http.post("/appointments/preview-pricing", payload);
    return assertSuccess(response);
  }

  async getAppointmentHistory() {
    const response = await this.http.get("/appointments", { params: { limit: 100 } });
    const data = assertSuccess(response);
    const appointmentsArray = Array.isArray(data) ? data : (data?.items || []);
    return appointmentsArray.map(normalizeAppointmentHistoryItem);
  }

  async cancelAppointment(appointmentId: any) {
    const key = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `appointment-cancel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await this.http.post(`/appointments/${appointmentId}/cancel`, {}, {
      headers: { 'Idempotency-Key': key },
    });
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
