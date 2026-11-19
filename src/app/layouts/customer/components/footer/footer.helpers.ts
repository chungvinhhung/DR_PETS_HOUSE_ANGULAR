/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/Footer/Footer.jsx)
 */
import { homeImages } from '../../../../shared/customer/assets/home-images';

export const QUICK_LINKS = [
  ["Trang chủ", "/"],
  ["Bảng giá dịch vụ", "/dich-vu/grooming-spa"],
  ["Mua sắm", "/cua-hang"],
  ["Lịch sử đơn hàng", "/don-hang-cua-toi"],
  ["Hồ sơ thú cưng", "/thu-cung-cua-toi"],
  ["Lịch sử đặt lịch", "/lich-su-dat-lich"],
  ["Tra cứu đơn (không cần tài khoản)", "/tra-cuu-don-hang"],
  ["Thông tin cứu trợ", "/cuu-tro"],
];

export const SERVICE_LINKS = [
  ["Khám & Điều trị", "/dich-vu/kham-dieu-tri"],
  ["Grooming & Spa", "/dich-vu/grooming-spa"],
  ["Mua sắm sản phẩm", "/cua-hang"],
];

export const SUPPORT_LINKS = [
  ["Chính sách đặt lịch, đổi lịch & hủy lịch", "/policies/dat-lich-doi-huy-lich"],
  ["Chính sách vận chuyển", "/policies/van-chuyen"],
  ["Chính sách đổi/trả hàng", "/policies/doi-tra-hang"],
  ["Chính sách thanh toán", "/policies/phuong-thuc-thanh-toan"],
  ["Chính sách bán hàng", "/policies/huong-dan-mua-hang"],
  ["Chính sách bảo mật", "/policies/bao-mat"],
];

export const LEGAL_LINKS = [
  ["Chính sách bảo mật", "/policies/bao-mat"],
  ["Điều khoản dịch vụ", "/policies/dieu-khoan-dich-vu"],
  ["Cài đặt cookie", "/policies/cookie"],
];

export const MOBILE_SUPPORT_LINKS = [
  ...SUPPORT_LINKS.slice(0, 4),
  ...LEGAL_LINKS.slice(0, 2),
  SUPPORT_LINKS[4],
];

export const GENERAL_LINKS = [
  ["Về chúng tôi", "/about"],
  ["Liên hệ", "/contact"],
  ["Danh sách chi nhánh", "/contact#branches"],
];

export function isBlueBackground(element: any) {
  let current = element;

  while (current) {
    const color = getComputedStyle(current).backgroundColor;
    const channels = color.match(/\d+(?:\.\d+)?/g)?.map(Number);

    if (channels && channels.length >= 3 && (channels[3] ?? 1) > 0) {
      const [red, green, blue] = channels;
      return blue > red + 12 && blue > green - 18;
    }

    current = current.parentElement;
  }

  return false;
}

