import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { ApiClientService } from '../../../../core/services/api-client.service';

export interface AppointmentPricingPetInput {
  petId: string;
  weightKg: number | null;
  serviceIds: readonly string[];
}
export interface AppointmentDraftPricing {
  subtotal: number;
  surchargeAmount: number;
  discountAmount: number;
  total: number;
  /** Read-only service pricing; excludes authoritative voucher and payment settlement. */
  petCount: number;
}
function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function amountOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value
    : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function readPrice(raw: unknown): Omit<AppointmentDraftPricing, 'petCount'> {
  const outer = recordOf(raw);
  if (!outer) throw new Error('Backend trả về báo giá không đúng định dạng.');
  if (outer['EC'] !== undefined && outer['EC'] !== 0)
    throw new Error(String(outer['EM'] || 'Không thể xem báo giá.'));
  const data = recordOf(outer['DT']) ?? recordOf(outer['data']) ?? outer;
  const subtotal = amountOf(data['subtotal']);
  const surchargeAmount = amountOf(data['surcharge_amount']);
  const discountAmount = amountOf(data['discount_amount'] ?? 0);
  const total = amountOf(data['total']);
  if (subtotal === null || surchargeAmount === null || discountAmount === null || total === null)
    throw new Error('Báo giá chưa đủ tạm tính, phụ thu, giảm giá hoặc tổng tiền. Không sử dụng giá giả.');
  return { subtotal, surchargeAmount, discountAmount, total };
}
export function aggregateAppointmentDraftPricing(raw: readonly unknown[]): AppointmentDraftPricing {
  if (!raw.length) throw new Error('Chưa chọn thú cưng để xem báo giá.');
  const parts = raw.map(readPrice);
  return {
    petCount: parts.length,
    subtotal: parts.reduce((n, part) => n + part.subtotal, 0),
    surchargeAmount: parts.reduce((n, part) => n + part.surchargeAmount, 0),
    discountAmount: parts.reduce((n, part) => n + part.discountAmount, 0),
    total: parts.reduce((n, part) => n + part.total, 0),
  };
}
export interface EstimatedPaymentSplit {
  dueNow: number;
  dueAtClinic: number;
}
/** Display-only WBS 4.3 ratios. Server payment/rounding rules always override. */
export function estimateAppointmentPayment(total: number, method: 'PAY_AT_STORE' | 'ONLINE_MOCK'): EstimatedPaymentSplit {
  const dueNow = method === 'ONLINE_MOCK' ? total : Math.round(total * 0.3);
  return { dueNow, dueAtClinic: total - dueNow };
}

@Injectable({ providedIn: 'root' })
export class AdminAppointmentPricingPreviewService {
  private readonly api = inject(ApiClientService);

  /**
   * Existing /appointments/preview-pricing is a read-only Customer price hint,
   * not an Admin quote and never authorizes creating a booking.
   */
  preview(pets: readonly AppointmentPricingPetInput[]): Observable<AppointmentDraftPricing> {
    if (!pets.length || pets.some(pet => !pet.serviceIds.length))
      throw new Error('Chọn đầy đủ thú cưng và dịch vụ trước khi xem giá.');
    return forkJoin(pets.map(pet => {
      const petId = /^\d+$/.test(pet.petId) ? pet.petId : undefined;
      const payload = {
        ...(petId ? { pet_id: petId } : {}),
        pet_data: pet.weightKg !== null && pet.weightKg > 0
          ? { weight_kg: pet.weightKg } : {},
        service_ids: pet.serviceIds.map(serviceId => ({ service_id: serviceId, quantity: 1 })),
      };
      return this.api.post<unknown>('/appointments/preview-pricing', payload);
    })).pipe(map(responses => aggregateAppointmentDraftPricing(responses)));
  }
}
