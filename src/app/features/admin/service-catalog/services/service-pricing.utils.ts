import { ServiceApiRecord, ServicePriceVariant } from '../models/service-catalog.model';

/** Tier IDs supported by the current price editor. Keep list/detail/edit in sync. */
export const SERVICE_PRICE_TIER_KEYS = ['XS', 'S', 'M', 'L', 'XL'] as const;
export type ServicePriceTierKey = typeof SERVICE_PRICE_TIER_KEYS[number];

const WEIGHT_BOUNDS: Readonly<Record<ServicePriceTierKey, readonly [number | null, number | null]>> = {
  XS: [null, 5],
  S: [5, 10],
  M: [10, 20],
  L: [20, 30],
  XL: [30, null],
};

function tierKey(variant: ServicePriceVariant): ServicePriceTierKey | null {
  const name = typeof variant.label === 'string' ? variant.label.trim().toUpperCase() : '';
  if (SERVICE_PRICE_TIER_KEYS.some((key) => key === name)) return name as ServicePriceTierKey;

  // Older BE data may contain range boundaries but not our short display labels.
  // Only map exact known boundaries; never guess from an array index or a price.
  const min = variant.minWeightKg ?? null;
  const max = variant.maxWeightKg ?? null;
  if (min === null && max === null) return null;
  return SERVICE_PRICE_TIER_KEYS.find((key) =>
    WEIGHT_BOUNDS[key][0] === min && WEIGHT_BOUNDS[key][1] === max,
  ) ?? null;
}

export interface ResolvedServicePricing {
  /** Fixed amounts guaranteed to map to the same rows shown by the edit form. */
  readonly fixedTiers: ReadonlyMap<ServicePriceTierKey, number>;
  readonly weightPricing: boolean;
  /** A base price is only confirmed in the legacy payload without a variants field. */
  readonly confirmedBasePrice: number | null;
  /** Backend data cannot be represented unambiguously in the current form. */
  readonly hasUnmappedPricing: boolean;
}

export function resolveServicePricing(raw: ServiceApiRecord): ResolvedServicePricing {
  const variants = raw.priceVariants ?? [];
  const fixed = new Map<ServicePriceTierKey, number>();
  let hasUnmappedPricing = false;

  for (const variant of variants) {
    const key = tierKey(variant);
    const validAmount = typeof variant.price === 'number'
      && Number.isSafeInteger(variant.price) && variant.price > 0;
    if (!key || !validAmount || fixed.has(key)) {
      hasUnmappedPricing = true;
      continue;
    }
    fixed.set(key, variant.price);
  }

  const confirmedBasePrice =
    raw.priceVariants == null && typeof raw.basePrice === 'number'
    && Number.isSafeInteger(raw.basePrice) && raw.basePrice > 0
      ? raw.basePrice : null;

  // Explicit [] plus a positive basePrice is ambiguous: this could be stale
  // BE pricing after selecting quote, or an old fixed-price-only service.
  if (variants.length === 0 && raw.priceVariants != null && raw.basePrice > 0) {
    hasUnmappedPricing = true;
  }

  return {
    fixedTiers: fixed,
    weightPricing: variants.length > 0,
    confirmedBasePrice,
    hasUnmappedPricing,
  };
}
