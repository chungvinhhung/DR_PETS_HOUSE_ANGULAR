import { ServiceApiRecord, ServicePriceVariant } from '../models/service-catalog.model';

/** Weight tiers agreed with BE canonical catalog, in display order. */
export const SERVICE_PRICE_TIER_KEYS = ['XS', 'S', 'M', 'L', 'XL'] as const;
export type ServicePriceTierKey = typeof SERVICE_PRICE_TIER_KEYS[number];
const TIER_BOUNDARIES: Readonly<Record<ServicePriceTierKey, readonly [number | null, number | null]>> = {
  XS: [0, 4.999],
  S: [5, 9.999],
  M: [10, 19.999],
  L: [20, 30],
  XL: [30.001, null],
};

function isTier(value: unknown): value is ServicePriceTierKey {
  return typeof value === 'string' &&
    SERVICE_PRICE_TIER_KEYS.some(key => key === value.toUpperCase());
}

/** Prefer machine-readable tier; accept canonical descriptive labels and exact legacy boundaries. */
function tierKey(variant: ServicePriceVariant): ServicePriceTierKey | null {
  if (isTier(variant.tier)) return variant.tier!.toUpperCase() as ServicePriceTierKey;
  const label = typeof variant.label === 'string' ? variant.label.trim().toUpperCase() : '';
  const prefix = /^(XS|S|M|L|XL)(?=\s|\(|$)/.exec(label)?.[1];
  if (isTier(prefix)) return prefix;
  const min = variant.minWeightKg ?? null;
  const max = variant.maxWeightKg ?? null;
  if (min === null && max === null) return null;
  for (const key of SERVICE_PRICE_TIER_KEYS) {
    const [bMin, bMax] = TIER_BOUNDARIES[key];
    if (min === bMin && max === bMax) return key;
  }
  // Legacy BE used exclusive upper-bound labels without the .999 representation.
  const legacy: Record<ServicePriceTierKey, readonly [number | null, number | null]> = {
    XS: [null, 5], S: [5, 10], M: [10, 20], L: [20, 30], XL: [30, null],
  };
  return SERVICE_PRICE_TIER_KEYS.find(key =>
    legacy[key][0] === min && legacy[key][1] === max) ?? null;
}

export interface ResolvedServicePricing {
  readonly fixedTiers: ReadonlyMap<ServicePriceTierKey, number>;
  readonly quoteTiers: ReadonlySet<ServicePriceTierKey>;
  readonly weightPricing: boolean;
  readonly confirmedBasePrice: number | null;
  readonly hasUnmappedPricing: boolean;
}

export function resolveServicePricing(raw: ServiceApiRecord): ResolvedServicePricing {
  const variants = Array.isArray(raw.priceVariants) ? raw.priceVariants : [];
  const fixed = new Map<ServicePriceTierKey, number>();
  const quoteTiers = new Set<ServicePriceTierKey>();
  let hasUnmappedPricing = false;

  for (const variant of variants) {
    const key = tierKey(variant);
    if (!key || fixed.has(key) || quoteTiers.has(key)) {
      hasUnmappedPricing = true;
      continue;
    }
    if (variant.mode === 'QUOTE' || (key === 'XL' && variant.price == null)) {
      if (variant.price != null || (key !== 'XL' && variant.mode !== 'QUOTE')) {
        hasUnmappedPricing = true;
      }
      quoteTiers.add(key);
      continue;
    }
    const value = variant.price;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || key === 'XL') {
      hasUnmappedPricing = true;
      continue;
    }
    fixed.set(key, value);
  }

  // Medical fixed-price services legitimately omit priceVariants in the canonical API.
  const isSinglePrice = raw.serviceType !== 'GROOMING' && raw.bookingMode !== 'CONTACT_ONLY';
  const confirmedBasePrice = variants.length === 0 && isSinglePrice &&
    typeof raw.basePrice === 'number' && Number.isSafeInteger(raw.basePrice) && raw.basePrice > 0
      ? raw.basePrice : null;
  if (raw.serviceType === 'GROOMING' && variants.length === 0 && raw.basePrice > 0) {
    hasUnmappedPricing = true;
  }
  return {
    fixedTiers: fixed,
    quoteTiers,
    weightPricing: variants.length > 0,
    confirmedBasePrice,
    hasUnmappedPricing,
  };
}
