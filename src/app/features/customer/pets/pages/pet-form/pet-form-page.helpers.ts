/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Pet/PetFormPage.jsx)
 */

const buddyImg = '/assets/customer/images/pets/buddy.jpg';
const lunaImg = '/assets/customer/images/pets/luna.jpg';
const maxImg = '/assets/customer/images/pets/max.jpg';
const snowImg = '/assets/customer/images/pets/snow.jpg';
const uploadIcon = '/assets/customer/icons/upload-icon.png';

export const petImages = {
  Buddy: buddyImg,
  Luna: lunaImg,
  Max: maxImg,
  Snow: snowImg,
};

export const PET_SPECIES_OPTIONS = [
  { value: "dog", label: "Chó" },
  { value: "cat", label: "Mèo" },
  { value: "other", label: "Khác" },
];

export const getSpeciesInputValue = (pet: any = {}) => {
  const rawValue = String(pet.speciesId || pet.species_id || "").toLowerCase();
  if (PET_SPECIES_OPTIONS.some((option: any) => option.value === rawValue)) return rawValue;

  const rawLabel = String(pet.species || pet.speciesName || pet.species_name || "").toLowerCase();
  if (rawLabel.includes("chó") || rawLabel.includes("cho") || rawLabel.includes("dog")) return "dog";
  if (rawLabel.includes("mèo") || rawLabel.includes("meo") || rawLabel.includes("cat")) return "cat";
  return rawLabel || rawValue ? "other" : "";
};

export const getAgeInputValue = (value: any) => {
  if (value === undefined || value === null) return "";
  const match = String(value).match(/\d+(\.\d+)?/);
  return match ? match[0] : "";
};

export const ACCEPTED_MEDICAL_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const MAX_MEDICAL_FILE_SIZE = 10 * 1024 * 1024;

export const formatFileSize = (bytes: any = 0) => {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export const createUploadedFile = (file: any) => ({
  id: `${Date.now()}-${file.name}`,
  name: file.name,
  size: formatFileSize(file.size),
  type: file.type,
  fileUrl: URL.createObjectURL(file),
  file,
});

export const getFileUrl = (file: any = {}) => file.url || file.fileUrl || "";

export const isImageFile = (file: any = {}) => {
  const fileName = file.name || file.fileName || "";
  return file.type?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(fileName);
};

export const getLatestDate = (records: any) => {
  if (!records || records.length === 0) return "Chưa khám";
  
  const validRecords = records.filter((r: any) => r && r.date);
  if (validRecords.length === 0) return "Chưa khám";

  const sorted = [...validRecords].sort((a: any, b: any) => {
    const [d1, m1, y1] = a.date.split('/');
    const [d2, m2, y2] = b.date.split('/');
    return Number(new Date(y2, m2 - 1, d2)) - Number(new Date(y1, m1 - 1, d1));
  });
  
  return sorted[0].date;
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

export const saveStoredPets = (pets: any) => {
  localStorage.setItem("petsData", JSON.stringify(pets));
};

export const buildLocalPet = (petData: any, existingPet: any) => ({
  ...existingPet,
  id: existingPet?.id || `pet_${Date.now()}`,
  pet_id: existingPet?.pet_id,
  name: petData.name,
  speciesId: petData.speciesId,
  species: petData.species,
  breed: petData.breed,
  age: petData.age,
  gender: petData.gender === "male" ? "Đực" : petData.gender === "female" ? "Cái" : petData.gender,
  weight: petData.weightKg ? `${petData.weightKg} kg` : "",
  weightKg: petData.weightKg,
  healthStatus: petData.healthStatus,
  medicalNotes: petData.medicalNotes,
  avatar: petData.avatar,
  medicalRecords: petData.medicalRecords || existingPet?.medicalRecords || [],
});

export const upsertLocalPet = (petId: any, petData: any) => {
  const storedPets = readStoredPets();
  const existingPet = storedPets.find((item: any) => item.id === petId || String(item.pet_id) === String(petId));
  const nextPet = buildLocalPet(petData, existingPet);
  const nextPets = existingPet
    ? storedPets.map((item: any) => (item.id === existingPet.id ? nextPet : item))
    : [nextPet, ...storedPets];

  saveStoredPets(nextPets);
  return nextPet;
};

