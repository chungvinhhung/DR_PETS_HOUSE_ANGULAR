/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/booking/BookingPaymentStep.jsx)
 */
import { bookingImages } from '../../../../shared/customer/assets/booking-images';
import { BOOKING_PAYMENT_METHODS } from '../data/booking-data';
import { formatVnd } from '../../../../shared/customer/utils/currency';

export const {
  paymentCalendarIcon,
  paymentPersonIcon,
  paymentPetIcon,
  paymentPhoneIcon,
} = bookingImages;

export const formatAppointmentDate = (date: any, slot: any) => {
  if (!date) {
    return slot ? `Chưa chọn ngày • ${slot}` : "Chưa chọn ngày";
  }

  return `${date.getDate()} tháng ${date.getMonth() + 1}, ${date.getFullYear()}${slot ? ` • ${slot}` : ""}`;
};

export const formatMoney = (value: any) => formatVnd(value);

export const getWeightValue = (weight: any) => {
  const normalizedWeight = String(weight ?? "").replace(",", ".");
  const value = Number.parseFloat(normalizedWeight);

  return Number.isFinite(value) ? value : 0;
};

export const getBookingPets = ({ petInfos = [], selectedPets = [], petInfo, selectedPet }: any = {}) => {
  const primaryPets = petInfos.length > 0 ? petInfos : selectedPets;
  const fallbackPets = ([petInfo, selectedPet].filter(Boolean) as any[]);

  return ((primaryPets.length > 0 ? primaryPets : fallbackPets).filter(Boolean) as any[]);
};

export const getPetWeight = (pet: any) =>
  pet?.weight ?? pet?.weightKg ?? pet?.weight_kg ?? pet?.raw?.weight_kg ?? "";

export const getPetId = (pet: any) => pet?.pet_id ?? pet?.id ?? pet?.raw?.pet_id ?? pet?.raw?.id;

export const isWeightSurchargeService = (service: any) =>
  Boolean(service.isWeightSurchargeApplied || service.weightSurcharge);

export const getWeightSurchargeForPet = (service: any, petWeight: any) => {
  if (!isWeightSurchargeService(service)) return 0;

  const weight = getWeightValue(petWeight);
  if (weight <= 0) return 0;

  return Math.ceil(weight / 3) * 10000;
};

export const getDistributedQuantity = (totalQuantity: any, petCount: any, petIndex: any) => {
  const safePetCount = Math.max(petCount, 1);
  const safeQuantity = Math.max(Number(totalQuantity) || safePetCount, safePetCount);
  const baseQuantity = Math.floor(safeQuantity / safePetCount);
  const extraQuantity = safeQuantity % safePetCount;

  return baseQuantity + (petIndex < extraQuantity ? 1 : 0);
};

export const normalizeServiceQuantity = (quantity: any, petCount: any) => {
  const safePetCount = Math.max(petCount, 1);
  const safeQuantity = Math.max(Number(quantity) || safePetCount, safePetCount);

  return Math.ceil(safeQuantity / safePetCount) * safePetCount;
};

export const getWeightSurchargeForPets = (service: any, pets: any, totalQuantity: any) => {
  const petCount = Math.max(pets.length, 1);

  return pets.reduce(
    (sum: any, pet: any, petIndex: any) =>
      sum +
      getWeightSurchargeForPet(service, getPetWeight(pet)) *
        getDistributedQuantity(totalQuantity, petCount, petIndex),
    0,
  );
};

export const getPricingLineSurcharge = (line: any) =>
  Number(line?.surcharge ?? line?.surcharge_amount ?? 0);

export const getPricingLineTotal = (line: any) =>
  Number(line?.total ?? line?.total_price ?? line?.line_total ?? 0);

export const aggregatePricingPreviews = (previews: any) => {
  const serviceMap = new Map<any, any>();

  previews.forEach((preview: any) => {
    (preview?.services || []).forEach((line: any) => {
      const key = String(line.service_id);
      const current = serviceMap.get(key) || { ...line, surcharge: 0, total: 0 };

      serviceMap.set(key, {
        ...current,
        surcharge: current.surcharge + getPricingLineSurcharge(line),
        total: current.total + getPricingLineTotal(line),
      });
    });
  });

  const subtotal = previews.reduce((sum: any, item: any) => sum + Number(item?.subtotal || item?.price || 0), 0);
  const surcharge_amount = previews.reduce((sum: any, item: any) => sum + Number(item?.surcharge_amount || item?.surcharge || 0), 0);
  const discount_amount = previews.reduce((sum: any, item: any) => sum + Number(item?.discount_amount || item?.voucherDiscount || 0), 0);
  let total = previews.reduce((sum: any, item: any) => sum + Number(item?.total || item?.finalAmount || 0), 0);
  if (!total && subtotal) {
    total = Math.max(0, subtotal + surcharge_amount - discount_amount);
  }

  return {
    subtotal,
    surcharge_amount,
    discount_amount,
    total,
    services: (Array.from(serviceMap.values()) as any),
    voucher_error: previews.find((item: any) => item?.voucher_error)?.voucher_error || '',
  };
};
