/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Order/OrderPages.jsx)
 */
import { productImages } from '../../../../shared/customer/assets/product-images';
import { formatCurrency, formatOrderDate, getOrderSubtotal, getOrderTotal, ORDERS, ORDER_FILTERS, ORDER_STATUS } from '../data/order-data';

export const STATUS_STEPS = ["processing", "shipping", "delivered"];

export const EMPTY_ORDER_PRODUCT = {
  id: "empty-product",
  name: "",
  price: 0,
  quantity: 1,
  variant_name: "",
  image: productImages.detailImage,
};

export const getOrderProductType = (product: any = {}) =>
  (typeof product.variant === "string" && product.variant) ||
  product.type ||
  product.variant_name ||
  product.variant?.variant_name ||
  "Mặc định";

export const getOrderProductSize = (product: any = {}) =>
  product.size || product.size_label || product.sizeLabel || "Mặc định";

export const buildCheckoutItemsFromOrder = (order: any) =>
  (order?.products || [])
    .filter((product: any) => product.productId || product.id)
    .map((product: any) => ({
      productId: product.productId || product.id,
      variantId: product.variantId,
      name: product.name,
      price: product.price,
      qty: product.quantity || 1,
      quantity: product.quantity || 1,
      type: getOrderProductType(product),
      size: getOrderProductSize(product) === "Mặc định" ? "" : getOrderProductSize(product),
      image: product.image,
      selected: true,
    }));

export const shiftDate = (value: any, days: any) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

export const getStepDateLabel = (order: any, step: any) => {
  if (step === "processing") return formatOrderDate(order.orderedAt, false);
  if (!order.estimatedDelivery) return "Đang cập nhật";
  if (step === "shipping") return formatOrderDate(shiftDate(order.estimatedDelivery, -1), false);
  return order.status === "delivered"
    ? formatOrderDate(order.estimatedDelivery, false)
    : `Dự kiến ${formatOrderDate(order.estimatedDelivery, false)}`;
};

