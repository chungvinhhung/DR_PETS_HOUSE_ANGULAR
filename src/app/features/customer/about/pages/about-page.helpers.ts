/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/About/AboutPage.jsx)
 */
import { aboutDecorations, aboutDoctors, aboutGallerySlides, aboutMilestones, aboutServices, commitmentBenefits } from '../data/about-data';

const heroLogo = '/assets/customer/images/home/hero-logo.png';

export const imageUrl = (name: any) =>
  `/assets/customer/images/about/${name}`;

export const figmaImageUrl = (name: any) =>
  `/assets/customer/images/about/figma/${name}`;

export const cx = (...classes: any[]) => (classes.filter(Boolean) as any[]).join(" ");

export const containerClass = "mx-auto w-[min(1200px,calc(100%-48px))] max-[620px]:w-[min(calc(100%-28px),1180px)]";

export const sectionTitleClass =
  "m-0 text-center font-['Baloo_Tamma'] text-[64px] font-normal leading-[1.1] max-[900px]:text-[34px]";

export const primaryButtonClass =
  "inline-flex min-h-[44px] items-center justify-center gap-[7px] border border-secondary bg-secondary px-[22px] py-2 font-['Roboto'] text-[15px] font-medium text-[#222] no-underline transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#fbc02d] hover:bg-[#fbc02d] hover:shadow-[0_5px_12px_rgba(13,71,161,0.18)] active:translate-y-0 active:scale-[0.98] active:shadow-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-[rgba(13,71,161,0.45)]";

export const roundControlClass =
  "grid size-10 place-items-center rounded-full border-0 bg-secondary text-[#0f172a] transition-[background-color,color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-blue-900 hover:text-white hover:shadow-[0_5px_12px_rgba(13,71,161,0.28)] active:scale-[0.94] active:shadow-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-[rgba(13,71,161,0.45)]";

export const serviceShapes = [
  {
    image: "rounded-[303px_112px_309px_196px]",
    ring:
      "rounded-[322px_118px_330px_207px] bg-[rgba(255,215,0,0.2)] rotate-[2.9deg]",
  },
  {
    image: "rounded-[152px_196px_354px_309px]",
    ring:
      "rounded-[161px_207px_376px_330px] bg-[rgba(239,108,0,0.3)] -rotate-[2.5deg]",
  },
  {
    image: "rounded-[303px_152px_309px_196px]",
    ring:
      "rounded-[322px_118px_330px_207px] bg-[rgba(255,215,0,0.2)] rotate-[2.9deg]",
  },
];

