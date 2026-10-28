import type { CatalogService } from '../../service-catalog/models/service-catalog.model';

/** An optional additional service for one pet, ordered after the primary service. */
export interface ExtraPetService {
  id: string;
  petId: string;
  serviceId: string;
}

export interface AppointmentSegmentPreview {
  key: string;
  petId: string;
  petName: string;
  serviceId: string;
  serviceName: string;
  sequence: number;
  durationMinutes: number | null;
  startOffsetMinutes: number | null;
  requiredStaffRole: string;
  /** Review is a separate medical requirement, not an invented bookable service. */
  requiresVeterinarianReview: boolean;
  referencePrice: number | null;
}

export function buildAppointmentSegments(
  pets: readonly { id: string; name: string }[],
  primaryServiceId: string,
  extras: readonly ExtraPetService[],
  services: readonly CatalogService[],
): AppointmentSegmentPreview[] {
  const byId = new Map(services.map(service => [service.id, service]));
  const result: AppointmentSegmentPreview[] = [];
  for (const pet of pets) {
    const serviceIds = [
      ...(primaryServiceId ? [primaryServiceId] : []),
      ...extras.filter(row => row.petId === pet.id && row.serviceId).map(row => row.serviceId),
    ];
    let offset: number | null = 0;
    for (const [index, serviceId] of serviceIds.entries()) {
      const service = byId.get(serviceId);
      // A stale/disabled service is never silently included in the planned booking.
      if (!service || service.bookingMode !== 'BOOKABLE' || service.status !== 'ACTIVE') continue;
      const duration = typeof service.durationMinutes === 'number'
        && Number.isFinite(service.durationMinutes) && service.durationMinutes > 0
          ? service.durationMinutes : null;
      const referencePrice = !service.pricingDataWarning
        && typeof service.referencePrice === 'number'
        && Number.isFinite(service.referencePrice) && service.referencePrice >= 0
          ? service.referencePrice : null;
      result.push({
        key: pet.id + ':' + serviceId,
        petId: pet.id,
        petName: pet.name || 'Thú cưng',
        serviceId,
        serviceName: service.name,
        sequence: index + 1,
        durationMinutes: duration,
        startOffsetMinutes: offset,
        requiredStaffRole: service.executorRole,
        requiresVeterinarianReview: service.category === 'MEDICAL'
          && service.executorRole === 'NURSE',
        referencePrice,
      });
      offset = offset === null || duration === null ? null : offset + duration;
    }
  }
  return result;
}

/** Show prices as references only; BE owns all final price and surcharge calculations. */
export function segmentReferenceSubtotal(segments: readonly AppointmentSegmentPreview[]): number | null {
  if (!segments.length || segments.some(row => row.referencePrice === null)) return null;
  return segments.reduce((sum, row) => sum + (row.referencePrice ?? 0), 0);
}

/** A duplicated service for the same pet must be blocked rather than double billed. */
export function hasDuplicatePetService(
  petId: string, serviceId: string, primaryServiceId: string,
  extras: readonly ExtraPetService[], exceptRowId = '',
): boolean {
  if (!petId || !serviceId) return false;
  return primaryServiceId === serviceId ||
    extras.some(row => row.id !== exceptRowId && row.petId === petId && row.serviceId === serviceId);
}
