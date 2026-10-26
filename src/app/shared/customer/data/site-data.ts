/**
 * Chuyển từ React: src/data/siteData.js
 */
import { footerImages } from '../assets/footer-images';

export const FOOTER_COLUMNS = [
  { title: "PRODUCT", links: ["Pricing", "Overview", "Browse", "Accessibility", "Five"] },
  { title: "Solutions", links: ["Brainstorming", "Ideation", "Wireframing", "Research"] },
  { title: "Resources", links: ["Help Center", "Blog", "Tutorials"] },
  { title: "Company", links: ["About", "Press", "Events", "Careers"] },
];

export const FOOTER_SOCIALS = [
  { name: "YouTube", icon: footerImages.youtube },
  { name: "Facebook", icon: footerImages.facebook },
  { name: "Twitter", icon: footerImages.twitter },
  { name: "Instagram", icon: footerImages.instagram },
  { name: "LinkedIn", icon: footerImages.linkedin },
];

export const FOOTER_LEGAL_LINKS = ["Terms", "Privacy", "Contact"];
