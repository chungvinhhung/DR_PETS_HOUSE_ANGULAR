/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Rescue/RescuePage.jsx)
 */
import { rescueImages } from '../../../../shared/customer/assets/rescue-images';
import { RESCUE_PARTNERS, RESCUE_PETS } from '../data/rescue-data';
import { normalizeAdoptionRequest } from '../../../../core/customer/services/api/rescue-api.service';

export const STATUS_FILTERS = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: "Còn chờ", value: "waiting" },
  { label: "Đã có tổ ấm", value: "adopted" },
];

export const RESCUE_PAGE_SIZE = 6;

