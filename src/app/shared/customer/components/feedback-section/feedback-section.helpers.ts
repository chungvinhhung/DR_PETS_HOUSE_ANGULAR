/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/shop/FeedbackSection.jsx)
 */
import { shopImages } from '../../assets/shop-images';
import { FEEDBACK_PAGE_COUNT, FEEDBACK_PAGES } from '../../data/feedback-data';

export const SECTION_TITLE_TYPOGRAPHY = {
  fontFamily: '"Baloo Tamma 2", "Baloo 2", cursive',
  fontWeight: 700,
  fontStyle: "normal",
  fontSize: "64px",
  lineHeight: "110%",
  letterSpacing: "0px",
};

/** Figma: vùng nội dung card — chiều cao cố định từng khối */
export const FEEDBACK_QUOTE_LINES = 4;

export const FEEDBACK_QUOTE_LINE_HEIGHT = 28;

export const FEEDBACK_QUOTE_HEIGHT = FEEDBACK_QUOTE_LINES * FEEDBACK_QUOTE_LINE_HEIGHT;

export const FEEDBACK_AUTHOR_HEIGHT = 68;

