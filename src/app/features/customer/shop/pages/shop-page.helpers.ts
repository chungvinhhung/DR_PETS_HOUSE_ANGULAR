/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Shop/ShopPage.jsx)
 */
import { shopImages } from '../../../../shared/customer/assets/shop-images';
import { FEATURED_PRODUCTS, PRODUCT_CATEGORIES, SHOP_PRODUCTS, SHOP_PROMOTION_PAGES } from '../../../../shared/customer/data/shop-data';

export const FLASH_SALE_FALLBACK_MS = 5 * 60 * 60 * 1000;

export const SECTION_TITLE_TYPOGRAPHY = {
  fontFamily: '"Baloo Tamma 2", "Baloo 2", cursive',
  fontWeight: 700,
  fontStyle: "normal",
  fontSize: "64px",
  lineHeight: "110%",
  letterSpacing: "0px",
};

export function getFallbackFlashSaleEndTime() {
  return new Date(Date.now() + FLASH_SALE_FALLBACK_MS).toISOString();
}

export function getFlashSaleCountdownTarget(sale: any) {
  const endTime = sale?.endTime ? new Date(sale.endTime).getTime() : NaN;
  if (Number.isFinite(endTime) && endTime > Date.now()) return sale.endTime;

  const startTime = sale?.startTime ? new Date(sale.startTime).getTime() : NaN;
  if (Number.isFinite(startTime) && startTime > Date.now()) return sale.startTime;

  return getFallbackFlashSaleEndTime();
}

export function getRemainingTimeParts(targetTime: any) {
  const target = new Date(targetTime).getTime();
  const remainingMs = Number.isFinite(target) ? Math.max(target - Number(Date.now()), 0) : FLASH_SALE_FALLBACK_MS;
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value: any) => String(value).padStart(2, "0"));
}

