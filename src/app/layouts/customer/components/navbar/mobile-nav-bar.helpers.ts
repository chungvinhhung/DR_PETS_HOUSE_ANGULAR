/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/Navbar/MobileNavBar.jsx)
 */
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';
import { getSearchSuggestions as getMockSearchSuggestions } from '../../../../shared/customer/data/search-results-data';
import { formatVnd } from '../../../../shared/customer/utils/currency';
import { NAV_LINKS } from '../../constants/navbar-menu-links';

const cartIcon = '/assets/customer/images/cart_icon.svg';

export const SEARCH_DEBOUNCE_MS = 280;

export const EMPTY_SUGGESTIONS: any = { suggestions: [], products: [], total: 0 };

