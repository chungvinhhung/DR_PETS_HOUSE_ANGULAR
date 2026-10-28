/**
 * Chuyển từ React: src/components/checkout/checkoutAssets.js
 */

const product = '/assets/customer/images/checkout/product-thumb.png';
const backArrow = '/assets/customer/images/checkout/back-arrow.svg';
const locationPin = '/assets/customer/images/checkout/location-pin.svg';
const momo = '/assets/customer/images/checkout/momo.png';
const zalopay = '/assets/customer/images/checkout/zalopay.png';
const vnpay = '/assets/customer/images/checkout/vnpay.png';
const radioUnchecked = '/assets/customer/images/checkout/radio-unchecked.svg';
const radioChecked = '/assets/customer/images/checkout/radio-checked.svg';
const bankIcon = '/assets/customer/images/checkout/bank.svg';
const checkmark = '/assets/customer/images/checkout/coupon-error.svg';
const atmIcon = '/assets/customer/images/checkout/atm-icon.svg';
const cardIcon = '/assets/customer/images/checkout/card-icon.svg';

export const checkoutImages = {
  product,
  backArrow,
  locationPin,
  momo,
  zalopay,
  vnpay,
  radioUnchecked,
  radioChecked,
  bankIcon,
  checkmark,
  atmIcon,
  cardIcon,
};

export const GUEST_ORDER_ITEMS = [
  {
    id: 1,
    name: "Hạt dinh dưỡng cao cấp Petsol",
    price: "50.000đ",
    type: "màu xanh",
    size: "1,5kg",
    qty: 2,
  },
  {
    id: 2,
    name: "Laptop lenovhbhfbv fbdfhdvd chhvuhv",
    price: "89.000đ",
    type: "màu xanh",
    size: "1,5kg",
    qty: 2,
  },
  {
    id: 3,
    name: "Hạt dinh dưỡng cao cấp Petsol",
    price: "50.000đ",
    type: "màu xanh",
    size: "1,5kg",
    qty: 2,
  },
  {
    id: 4,
    name: "Hạt dinh dưỡng cao cấp Petsol",
    price: "50.000đ",
    type: "màu xanh",
    size: "1,5kg",
    qty: 2,
  },
];

export const ORDER_ITEMS = GUEST_ORDER_ITEMS;

export const GUEST_ORDER_TOTAL = "200.000đ";

export const ONLINE_PAYMENT_METHODS = [
  {
    id: "momo",
    label: "MoMo",
    icon: checkoutImages.momo,
    iconClass: "h-[32px] w-[34px] object-contain",
  },
  {
    id: "zalopay",
    label: "ZaloPay",
    icon: checkoutImages.zalopay,
    iconClass: "size-[49px] object-cover",
  },
  {
    id: "vnpay",
    label: "VNPay",
    icon: checkoutImages.vnpay,
    iconClass: "h-[29px] w-[37px] object-cover",
  },
  {
    id: "bank",
    label: "Chuyển khoản ngân hàng",
    icon: checkoutImages.bankIcon,
    iconClass: "size-8",
  },
  {
    id: "atm",
    label: "Thẻ ATM",
    icon: checkoutImages.atmIcon,
    iconClass: "h-[25px] w-8",
  },
  {
    id: "card",
    label: "Thẻ Tín dụng/Ghi nợ",
    icon: checkoutImages.cardIcon,
    iconClass: "h-[25px] w-8",
  },
];

export const ORDER_CODE = "BK-8712-2023";
