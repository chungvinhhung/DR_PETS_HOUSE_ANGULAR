/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/Navbar/NavSearchBar.jsx)
 */
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';
import { getSearchSuggestions as getMockSearchSuggestions } from '../../../../shared/customer/data/search-results-data';

export const SEARCH_DEBOUNCE_MS = 280;

export const EMPTY_SUGGESTIONS: any = {
  suggestions: [],
  products: [],
  total: 0,
};

