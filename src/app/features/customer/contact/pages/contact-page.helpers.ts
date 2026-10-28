/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Contact/ContactPage.jsx)
 */
import { BRANCHES, CONTACT_CHANNELS, contactAssets } from '../data/contact-data';

export const INITIAL_FORM = {
  name: "",
  gender: "",
  phone: "",
  email: "",
  message: "",
};

export const getGoogleMapsLink = (address: any) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address,
  )}`;

export const getGoogleMapsEmbedLink = (address: any) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=14&output=embed`;

export const CONTACT_MAP_POSITIONS = BRANCHES.map((branch: any) => branch.mapPosition);

export function normalizeContactBranch(branch: any, index: any) {
  const fallback = (BRANCHES as any)[index % BRANCHES.length] || BRANCHES[0];

  return {
    ...fallback,
    ...branch,
    id: String(branch.id ?? branch.branch_id ?? fallback.id),
    name: branch.branch_name || branch.name || fallback.name,
    address: branch.address || fallback.address,
    hours: branch.operating_hours || branch.hours || fallback.hours,
    phone: branch.phone || fallback.phone,
    email: branch.email || "",
    mapPosition: branch.mapPosition || (CONTACT_MAP_POSITIONS as any)[index % CONTACT_MAP_POSITIONS.length],
  };
}

