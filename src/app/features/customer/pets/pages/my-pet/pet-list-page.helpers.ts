/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Pet/MyPetPage.jsx)
 */
import { MOCK_PETS } from '../../data/mock-pets';
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

export const readStoredPets = () => {
  try {
    const stored = localStorage.getItem("petsData");
    const pets = stored ? JSON.parse(stored) : [];
    return Array.isArray(pets) ? pets : [];
  } catch (error: any) {
    return [];
  }
};

export const getHealthStatusColor = (status: any) => {
  const safeStatus = status === "Khỏe mạnh" ? "Bình thường" : status;
  switch (safeStatus) {
    case "Đang điều trị":
      return { bg: "#fef0c7", dot: "#d97706", text: "#b45309" }; 
    case "Bình thường":
      return { bg: "#dcfce3", dot: "#22c55e", text: "#15803d" }; 
    case "Có bệnh nền":
      return { bg: "#f3e8ff", dot: "#6366f1", text: "#4338ca" }; 
    case "Cần tái khám":
      return { bg: "#fee2e2", dot: "#ef4444", text: "#b91c1c" }; 
    default:
      return { bg: "#dcfce3", dot: "#22c55e", text: "#15803d" };
  }
};

export const parseAgeToDays = (ageString: any) => {
  if (!ageString) return 0;
  const str = ageString.toLowerCase();
  const num = parseFloat(str); 
  if (isNaN(num)) return 0;

  if (str.includes("tuổi") || str.includes("năm")) return num * 365;
  if (str.includes("tháng")) return num * 30;
  if (str.includes("ngày")) return num;
  return num; 
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

export const PET_STATUS_FILTERS = ["Tất cả", "Bình thường", "Đang điều trị", "Có bệnh nền", "Cần tái khám"];

