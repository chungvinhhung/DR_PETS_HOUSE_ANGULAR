/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/shop/ShopHeroSection.jsx)
 */
import { shopImages } from '../../../../shared/customer/assets/shop-images';

export const AUTO_PLAY_MS = 5000;

export const SLIDE_COUNT = 3;

export const INDICATOR_ACTIVE_WIDTH = 80;

export const INDICATOR_INACTIVE_WIDTH = 45;

/** Layout slide 1 (Group 1/3 — 1268:5602) — dùng chung cho cả 3 slide */
export const HERO_LAYOUT = {
  background: shopImages.heroBg,
  backgroundImgClass:
    "absolute top-0 h-full w-[121.58%] max-w-none left-[-10.79%]",
  yellowInset: "inset-[10.09%_2.83%_10.23%_47.22%]",
  petFrame: "absolute right-[60px] top-[215.66px] h-[439.17px] w-[648px]",
};

export const HERO_SLIDES = shopImages.heroPets.map((petSrc: any, index: any) => ({
  ...HERO_LAYOUT,
  id: `slide-${index + 1}`,
  petSrc,
}));

export const FLOWER_ICON = shopImages.heroFlower;

