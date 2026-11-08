/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Pet/PetDetailPage.jsx)
 */
import { INITIAL_PET_EVENTS } from '../../data/pet-events';

const buddyImg = '/assets/customer/images/pets/buddy.jpg';
const lunaImg = '/assets/customer/images/pets/luna.jpg';
const maxImg = '/assets/customer/images/pets/max.jpg';
const snowImg = '/assets/customer/images/pets/snow.jpg';
const patternBg = '/assets/customer/images/pets/patterntaddnote.jpg';
const uploadIcon = '/assets/customer/icons/upload-icon.png';

export const petImages = {
  Buddy: buddyImg,
  Luna: lunaImg,
  Max: maxImg,
  Snow: snowImg,
};

export const toPetSlug = (pet: any = {}) => {
  const id = String(pet?.id || pet?.pet_id || pet?._id || '').trim();
  const rawName = String(pet?.name || 'thu-cung')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!id) return rawName || 'chi-tiet';
  return `${rawName || 'pet'}-${id.slice(-3)}`;
};


export const extractShortIdFromSlug = (slugOrId: any) => {
  const raw = String(slugOrId || '').trim();
  if (!raw) return '';
  // Nếu có dấu gạch ngang (vd: "bong-183") thì lấy phần đuôi sau dấu "-" cuối cùng
  return raw.includes('-') ? raw.split('-').pop() || raw : raw;
};

export const matchPetBySlugOrId = (pets: any[], slugOrId: any) => {
  if (!Array.isArray(pets) || !slugOrId) return null;
  const target = String(slugOrId).trim();
  const shortId = extractShortIdFromSlug(target);

  return (
    pets.find((item: any) => {
      const fullId = String(item?.id || item?.pet_id || item?._id || '');
      return fullId === target || (shortId && fullId.endsWith(shortId));
    }) || null
  );
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
  if (years > 0) return `${years} tuổi${months > 0 ? ` ${months} tháng` : ""}`;
  if (months > 0) return `${months} tháng${days > 0 ? ` ${days} ngày` : ""}`;
  return days > 0 ? `${days} ngày` : "Mới sinh";
};

export const formatAgeText = (value: any) => {
  if (value === undefined || value === null || value === "") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/[^\d.]/.test(text)) return text;
  return `${text} tuổi`;
};

export const ACCEPTED_UPLOAD_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;

export const formatFileSize = (bytes: any = 0) => {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export const createUploadedFile = (file: any) => {
  const url = URL.createObjectURL(file);
  return {
    id: `${Date.now()}-${file.name}`,
    name: file.name,
    size: formatFileSize(file.size),
    type: file.type,
    url,
    fileUrl: url,
    file,
  };
};

export const getFileUrl = (file: any = {}) => file.url || file.fileUrl || "";

export const isImageFile = (file: any = {}) => {
  const fileName = file.name || file.fileName || "";
  return file.type?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(fileName);
};

export const getUploadFiles = (files: any = []) => (files.map((item: any) => item.file).filter(Boolean) as any[]);

export const getColorClass = (type: any) => {
  switch(type) {
    case 'blue': return "bg-[#60a5fa]"; 
    case 'green': return "bg-[#4ade80]";
    case 'yellow': return "bg-[#fcd34d]";
    case 'red': return "bg-[#f87171]";
    default: return "bg-[#60a5fa]";
  }
};

export const convertTimeToInputFormat = (timeSACH: any) => {
  if (!timeSACH || timeSACH === "--:--") return "";
  try {
    const [time, modifier] = timeSACH.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    if (hours === 12 && modifier === 'SA') hours = 0;
    if (hours !== 12 && modifier === 'CH') hours += 12;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  } catch (error: any) { return ""; }
};

export const formatTimeToSACH = (time24h: any) => {
  if (!time24h) return "--:--";
  try {
    const [hourStr, minStr] = time24h.split(':');
    let hour = parseInt(hourStr, 10);
    const modifier = hour >= 12 ? 'CH' : 'SA';
    if (hour === 0) {
      hour = 12;
    } else if (hour > 12) {
      hour -= 12;
    }
    return `${String(hour).padStart(2, '0')}:${minStr} ${modifier}`;
  } catch (error: any) { return "--:--"; }
};

export const getEventDateParts = (event: any) => {
  if (event?.dateKey) {
    const date = new Date(event.dateKey);
    if (!Number.isNaN(date.getTime())) {
      return {
        day: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
      };
    }
  }

  return {
    day: Number(event?.day),
    month: 6,
    year: 2026,
  };
};

export const toDateKey = (date: any) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const isEventInDate = (event: any, day: any, month: any, year: any) => {
  const eventDate = getEventDateParts(event);
  return eventDate.day === day && eventDate.month === month && eventDate.year === year;
};

