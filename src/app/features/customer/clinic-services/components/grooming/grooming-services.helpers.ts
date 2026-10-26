/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/groomingSpa/GroomingServices.jsx)
 */
import { groomingImages } from '../../../../../shared/customer/assets/grooming-images';
import { GROOMING_SERVICES } from '../../../../../shared/customer/data/grooming-data';
import { groomingTitleStyles } from '../../utils/grooming-title-styles';

export const POSITIONS = [
  { id: 1, x: 167, y: 0 },
  { id: 2, x: 537, y: 0 },
  { id: 3, x: 907, y: 0 },
  { id: 4, x: 167, y: 454 },
  { id: 5, x: 537, y: 454 },
  { id: 6, x: 907, y: 454 },
  { id: 7, x: 167, y: 908 },
  { id: 8, x: 537, y: 908 },
  { id: 9, x: 907, y: 908 },
];

export function maskStyle(maskUrl: any) {
  return {
    WebkitMaskImage: `url(${maskUrl})`,
    maskImage: `url(${maskUrl})`,
    WebkitMaskSize: "355px 422px",
    maskSize: "355px 422px",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "0 0",
    maskPosition: "0 0",
  };
}

