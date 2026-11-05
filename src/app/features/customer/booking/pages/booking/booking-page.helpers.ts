/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Booking/BookingPage.jsx)
 */
import { BOOKING_SERVICES, BOOKING_SERVICE_TYPES } from '../../data/booking-data';
import { bookingImages } from '../../../../../shared/customer/assets/booking-images';
import { productImages } from '../../../../../shared/customer/assets/product-images';
import { formatVnd } from '../../../../../shared/customer/utils/currency';

const buddyImg = '/assets/customer/images/pets/buddy.jpg';

export const {
  serviceListIcon,
  serviceSelectedCheck,
  informationStepCheck,
  informationSelectedPetPhoto,
  petPickerMaxPhoto,
  petPickerLunaPhoto,
  petPickerCloseIcon,
} = bookingImages;

export const petImages = {
  Buddy: buddyImg,
  Luna: petPickerLunaPhoto,
  Max: petPickerMaxPhoto,
  Snow: informationSelectedPetPhoto,
};

export const INITIAL_BRANCH_OPTIONS = [
  { id: "6ad08e4417bf41f5954234c3", label: "Chi nhánh Quận 1 - 123 Nguyễn Thị Minh Khai, P. Bến Thành, Q.1, TP.HCM" },
  { id: "6ad08e4417bf41f5954234c4", label: "Chi nhánh Quận 7 - 456 Nguyễn Thị Thập, P. Tân Quy, Q.7, TP.HCM" },
];

export const BRANCH_OPTIONS = [
  "6ad08e4417bf41f5954234c3",
  "6ad08e4417bf41f5954234c4",
];

export const formatMoney = (value: any) => formatVnd(value);

export const DEFAULT_SERVICE_TYPE_ID = "clinic";

export const createEmptyPetInfo = () => ({
  id: `other-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: "",
  species: "",
  breed: "",
  age: "",
  weight: "",
  gender: "",
  status: "",
  notes: "",
});

export const profileToPetInfo = (pet: any) => ({
  id: pet.id,
  name: pet.name || "",
  species: pet.species || "",
  breed: pet.breed || "",
  age: pet.age || "",
  weight: pet.weightKg || String(pet.weight || "").replace(/[^\d.,]/g, ""),
  gender:
    pet.gender === "male" || pet.gender === "female"
      ? pet.gender
      : pet.gender === "♂"
        ? "male"
        : pet.gender === "♀"
          ? "female"
          : "",
  status:
    pet.healthStatus === "normal" || pet.healthStatus === "Bình thường"
      ? "normal"
      : pet.healthStatus === "treating" || pet.healthStatus === "Đang điều trị"
        ? "treating"
        : pet.healthStatus
          ? "chronic"
          : "",
  notes: pet.medicalNotes || "",
});

export const findSpeciesId = (speciesOptions: any = [], speciesName: any) => {
  const normalizedName = String(speciesName || "").trim().toLowerCase();
  if (!normalizedName) return "DOG";

  if (Array.isArray(speciesOptions) && speciesOptions.length > 0) {
    const aliasMap: Record<string, string[]> = {
      chó: ["cho", "chó", "dog", "canine"],
      mèo: ["meo", "mèo", "cat", "feline"],
      chim: ["chim", "bird"],
      thỏ: ["tho", "thỏ", "rabbit"],
      khác: ["khac", "khác", "other"],
    };
    const aliases = aliasMap[normalizedName] || [normalizedName];

    const matchedSpecies = speciesOptions.find((species: any) => {
      const backendName = String(species.species_name || species.name || "").trim().toLowerCase();
      const backendId = String(species.species_id || species.id || "").trim().toLowerCase();
      return aliases.some((alias: any) => backendName === alias || backendName.includes(alias) || backendId === alias);
    });

    if (matchedSpecies?.species_id || matchedSpecies?.id) {
      return matchedSpecies.species_id || matchedSpecies.id;
    }
  }

  // Fallback mapping directly to backend species enum
  if (normalizedName.includes("mèo") || normalizedName.includes("meo") || normalizedName.includes("cat")) return "CAT";
  if (normalizedName.includes("chim") || normalizedName.includes("bird")) return "BIRD";
  if (normalizedName.includes("thỏ") || normalizedName.includes("tho") || normalizedName.includes("rabbit")) return "RABBIT";
  if (normalizedName.includes("chó") || normalizedName.includes("cho") || normalizedName.includes("dog")) return "DOG";
  return "OTHER";
};

export const toBackendHealthStatus = (status: any) => {
  if (status === "normal") return "healthy";
  if (status === "treating") return "treating";
  if (status === "need_recheck") return "need_recheck";
  return "unknown";
};

export const isPetInfoComplete = (petInfo: any) =>
  petInfo.name.trim() &&
  petInfo.species &&
  String(petInfo.weight).trim() &&
  petInfo.status;

export const isPetInfoTouched = (petInfo: any) =>
  Boolean(
    String(petInfo.name || "").trim() ||
      petInfo.species ||
      String(petInfo.breed || "").trim() ||
      String(petInfo.age || "").trim() ||
      String(petInfo.weight || "").trim() ||
      petInfo.gender ||
      petInfo.status ||
      String(petInfo.notes || "").trim(),
  );

export const getDateKey = (date: any) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const getStartOfDay = (date: any) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isBeforeToday = (date: any) => getStartOfDay(date) < getStartOfDay(new Date());

export const isToday = (date: any) => getDateKey(date) === getDateKey(new Date());

export const getSlotStartMinutes = (slotValue: any) => {
  const [time] = slotValue.split(" - ");
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

export const isSlotInPast = (slotValue: any, selectedDate: any) => {
  if (!selectedDate || !isToday(selectedDate)) {
    return false;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return getSlotStartMinutes(slotValue) < nowMinutes;
};

export const isSlotBookable = (slotValue: any, selectedDate: any, timeSlots: any) => {
  const slot = timeSlots.find((item: any) => item.value === slotValue);

  return Boolean(slot?.available && selectedDate && !isBeforeToday(selectedDate) && !isSlotInPast(slotValue, selectedDate));
};

