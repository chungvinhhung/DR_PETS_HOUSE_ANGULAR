/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/rescue/AdoptionApplicationModal.jsx)
 */
import { ADOPTION_COMMITMENT_NOTE, ADOPTION_STEPS, ADOPTION_SUCCESS, COMMITMENT_QUESTIONS, CONTACT_FIELDS, LIVING_CONDITION_QUESTIONS } from '../data/adoption-form-data';
import { DEFAULT_USER_ADDRESSES, PROFILE_STORAGE_KEYS } from '../../../../core/customer/constants/user-profile-data';

export const buttonShadow =
  "shadow-[0px_1px_5px_0px_rgba(0,0,0,0.12),0px_2px_2px_0px_rgba(0,0,0,0.14),0px_3px_1px_-2px_rgba(0,0,0,0.2)]";

export const inputClass =
  "h-[52px] w-full rounded-[8px] border-2 border-[#D9E3F6] bg-white px-[26px] text-[16px] leading-6 text-[rgba(0,0,0,0.87)] outline-none transition focus:border-[#90CAF9] focus:ring-2 focus:ring-[#90CAF9]/30";

export const invalidInputClass = "border-[#c62828] ring-1 ring-[#c62828] focus:border-[#c62828] focus:ring-[#c62828]";

export const FIELD_ERROR_MESSAGE = "Vui lòng điền thông tin";

export const NEW_ADDRESS_VALUE = "__new_address__";

export const initialFormValues = {
  fullName: "",
  phone: "",
  gender: "",
  birthYear: "",
  address: "",
  housingType: "",
  familyConsent: "",
  currentPets: "",
  aloneTime: "",
  adoptionReason: "",
  futurePlan: "",
};

export function loadUserAddresses() {
  try {
    const storedAddresses = localStorage.getItem(PROFILE_STORAGE_KEYS.addresses);
    return storedAddresses ? JSON.parse(storedAddresses) : DEFAULT_USER_ADDRESSES;
  } catch {
    return DEFAULT_USER_ADDRESSES;
  }
}

export function getBirthYear(birthDate: any) {
  if (!birthDate) return "";
  const year = String(birthDate).match(/\d{4}/)?.[0];
  return year ?? "";
}

export function getPrefilledValues({ isAuthenticated, userProfile, addresses }: any) {
  if (!isAuthenticated) return initialFormValues;

  const defaultAddress =
    addresses.find((address: any) => address.isDefault) ?? addresses[0];

  return {
    ...initialFormValues,
    fullName: userProfile?.fullName ?? "",
    phone: userProfile?.phone ?? "",
    gender: userProfile?.gender ?? "",
    birthYear: getBirthYear(userProfile?.birthDate),
    address: defaultAddress?.address ?? "",
  };
}

export function getStepRequiredFields(stepId: any) {
  if (stepId === "contact") return CONTACT_FIELDS.filter((field: any) => field.required).map((field: any) => field.name);
  if (stepId === "living") return LIVING_CONDITION_QUESTIONS.filter((question: any) => question.required).map((question: any) => question.name);
  return COMMITMENT_QUESTIONS.filter((question: any) => question.required).map((question: any) => question.name);
}

export function getMissingFields(values: any, stepId: any) {
  return getStepRequiredFields(stepId).filter((field: any) => !String((values as any)[field] ?? "").trim());
}

