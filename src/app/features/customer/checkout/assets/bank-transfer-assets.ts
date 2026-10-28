/**
 * Chuyển từ React: src/components/checkout/bankTransferAssets.js
 */

const bankQr = '/assets/customer/images/checkout/bank-qr.svg';
const copyIcon = '/assets/customer/images/checkout/bank-copy-icon.svg';

export const BANK_TRANSFER_INFO = {
  bank: "Vietcombank",
  accountNumber: "123456789",
  accountHolder: "AZURE AMBER",
  amount: "250.000đ",
  orderCode: "BK-8712-2023",
};

export const bankTransferImages = {
  qrPlaceholder: bankQr,
  copyIcon,
};
