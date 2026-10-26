/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/checkout/ShoppingCheckout.jsx)
 */
import { checkoutImages, ONLINE_PAYMENT_METHODS, ORDER_CODE } from '../assets/checkout-assets';
import { formatVnd, getNumericPrice } from '../../../../shared/customer/utils/currency';
import { DEFAULT_USER_ADDRESSES } from '../../../../core/customer/constants/user-profile-data';

export function formatMoney(value: any) {
  return formatVnd(value);
}

