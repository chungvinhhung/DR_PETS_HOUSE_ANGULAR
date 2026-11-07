/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Pet/MyPetPage.jsx)
 */
import { appointmentImages } from '../../../../../shared/customer/assets/appointment-images';

const buddyImg = '/assets/customer/images/pets/buddy.jpg';
const lunaImg = '/assets/customer/images/pets/luna.jpg';
const maxImg = '/assets/customer/images/pets/max.jpg';
const snowImg = '/assets/customer/images/pets/snow.jpg';
const dogIcon = '/assets/customer/icons/dog-icon.png';
const catIcon = '/assets/customer/icons/cat-icon.png';
const pawIcon = '/assets/customer/icons/paw-icon.png';

export const petImages = {
  Buddy: buddyImg,
  Luna: lunaImg,
  Max: maxImg,
  Snow: snowImg,
};

export const getHealthStatusColor = (status: any) => {
  const safeStatus = getPetStatusLabel({ healthStatus: status });
  switch (safeStatus) {
    case "Đang điều trị":
      return { bg: "#fef0c7cc", dot: "#d97706", text: "#b45309" }; 
    case "Bình thường":
      return { bg: "#dcfce3cc", dot: "#22c55e", text: "#15803d" }; 
    case "Cần tái khám":
      return { bg: "#fee2e2cc", dot: "#ef4444", text: "#b91c1c" }; 
    default:
      return { bg: "#dcfce3cc", dot: "#22c55e", text: "#15803d" };
  }
};


export const getPetStatusLabel = (pet: any = {}) => {
  const status = String(typeof pet === "string" ? pet : pet.healthStatus ?? pet.health_status ?? "").trim().toLowerCase();
  if (["đang điều trị", "đang dieu tri", "treating", "treatment", "sick", "ill"].includes(status)) {
    return "Đang điều trị";
  }
  if (["cần tái khám", "can tai kham", "need_recheck", "recheck"].includes(status)) {
    return "Cần tái khám";
  }
  return "Bình thường";
};

export const parseAgeToDays = (ageValue: any) => {
  if (ageValue === undefined || ageValue === null || ageValue === '') return 0;
  
  if (typeof ageValue === 'number') return ageValue * 365;

  const str = String(ageValue).trim().toLowerCase();

  // Xử lý ngày sinh dạng DD/MM/YYYY hoặc ISO.
  const birthDate = str.includes("/")
    ? (() => {
        const parts = str.split("/");
        return parts.length === 3 ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) : null;
      })()
    : /^\d{4}-\d{2}-\d{2}/.test(str)
      ? new Date(str)
      : null;
  if (birthDate && !Number.isNaN(birthDate.getTime())) {
    return Math.max(0, Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Cộng dồn từng phần, vd. "2 tuổi 3 tháng", "1 năm 2 tuần"
  const UNIT_DAYS: Record<string, number> = { "tuổi": 365, "năm": 365, "tháng": 30, "tuần": 7, "ngày": 1 };
  const parts = [...str.matchAll(/(\d+(?:[.,]\d+)?)\s*(tuổi|năm|tháng|tuần|ngày)/g)];
  if (parts.length) {
    return parts.reduce((total, [, value, unit]) => total + parseFloat(value.replace(",", ".")) * UNIT_DAYS[unit], 0);
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  // Trường hợp chuỗi chỉ có số (ví dụ "3")
  return num * 365;
};

/** Id dùng trên URL chi tiết / chỉnh sửa: /thu-cung-cua-toi/:id */
export const getPetId = (pet: any = {}) => String(pet.id || pet.pet_id || pet.petId || "");

/** Số ngày tuổi, null nếu chưa có thông tin tuổi / ngày sinh. */
export const getPetAgeDays = (pet: any = {}) => {
  const value = pet.age !== undefined && pet.age !== null && pet.age !== "" ? pet.age : pet.birthDate;
  if (value === undefined || value === null || value === "") return null;
  const days = Number(parseAgeToDays(value));
  return Number.isFinite(days) ? days : null;
};

export const getPetAgeText = (pet: any = {}) =>
  formatAgeText(pet.age) || (pet.birthDate ? calculateAge(pet.birthDate) : "Chưa rõ");

const comparePetName = (a: any, b: any) =>
  String(a.name ?? "").trim().localeCompare(String(b.name ?? "").trim(), "vi", { sensitivity: "base", numeric: true });

export const PET_SORT_OPTIONS = [
  { value: "name", label: "Tên A-Z" },
  { value: "name-desc", label: "Tên Z-A" },
  { value: "age-asc", label: "Tuổi tăng dần" },
  { value: "age-desc", label: "Tuổi giảm dần" },
];

export const sortPets = (pets: any[], sortBy: string) => {
  const sorted = [...pets];
  if (sortBy === "name-desc" || sortBy === "z-a") return sorted.sort((a, b) => comparePetName(b, a));
  if (sortBy === "age-asc" || sortBy === "age-desc" || sortBy === "age") {
    const direction = sortBy === "age-asc" ? 1 : -1;
    return sorted.sort((a, b) => {
      const ageA = getPetAgeDays(a);
      const ageB = getPetAgeDays(b);
      // Thú cưng chưa rõ tuổi luôn nằm cuối danh sách
      if (ageA === null || ageB === null) return ageA === ageB ? comparePetName(a, b) : ageA === null ? 1 : -1;
      return (ageA - ageB) * direction || comparePetName(a, b);
    });
  }
  return sorted.sort(comparePetName);
};


export const calculateAge = (birthDateString: any) => {
  if (!birthDateString) return "Chưa rõ";
  const parts = birthDateString.split("/");
  if (parts.length !== 3) return birthDateString;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();

  let years = Number(today.getFullYear()) - Number(birthDate.getFullYear());
  let months = Number(today.getMonth()) - Number(birthDate.getMonth());
  let days = Number(today.getDate()) - Number(birthDate.getDate());

  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years > 0) {
    return `${years} tuổi${months > 0 ? ` ${months} tháng` : ""}`;
  } else if (months > 0) {
    return `${months} tháng${days > 0 ? ` ${days} ngày` : ""}`;
  } else {
    return days > 0 ? `${days} ngày` : "Mới sinh";
  }
};

export const formatAgeText = (value: any) => {
  if (value === undefined || value === null || value === "") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/[^\d.]/.test(text)) return text;
  return `${text} tuổi`;
};

export const getLatestCheckupDate = (pet: any) => {
  if (pet.medicalRecords && pet.medicalRecords.length > 0) {
    const validRecords = pet.medicalRecords.filter((r: any) => r && r.date);
    if (validRecords.length === 0) return pet.lastCheckup || "Chưa khám";

    const sorted = [...validRecords].sort((a: any, b: any) => {
      const [d1, m1, y1] = a.date.split('/');
      const [d2, m2, y2] = b.date.split('/');
      return Number(new Date(y2, m2 - 1, d2)) - Number(new Date(y1, m1 - 1, d1));
    });
    return sorted[0].date;
  }
  return pet.lastCheckup || "Chưa khám";
};

export const PET_STATUS_FILTERS = ["Tất cả", "Bình thường", "Đang điều trị", "Cần tái khám"];

/**
 * Chuyển tên + 3 ký tự cuối của ID: { name: "Bông", id: "...6510183" } -> "bong-183"
 */
export const toPetSlug = (pet: any = {}) => {
  const id = getPetId(pet);
  const rawName = String(pet.name || 'thu-cung')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!id) return rawName || 'chi-tiet';
  const shortId = id.slice(-3); // Lấy 3 ký tự cuối của ID
  return `${rawName || 'pet'}-${shortId}`;
};

/**
 * Tìm lại thú cưng trong danh sách của tài khoản từ slug trên URL
 */
export const matchPetBySlug = (pets: any[], slugParam: string) => {
  if (!slugParam || !Array.isArray(pets)) return null;

  // 1. Khớp chính xác toàn bộ ID gốc (nếu dùng link cũ)
  const exactIdMatch = pets.find((p) => getPetId(p) === slugParam);
  if (exactIdMatch) return exactIdMatch;

  // 2. Khớp đúng cả slug "ten-xxx"
  const exactSlugMatch = pets.find((p) => toPetSlug(p) === slugParam);
  if (exactSlugMatch) return exactSlugMatch;

  // 3. Dự phòng: đối chiếu 3 ký tự cuối sau dấu gạch ngang cuối cùng
  const shortId = slugParam.split('-').pop() || '';
  return pets.find((p) => getPetId(p).endsWith(shortId)) || null;
};

