/**
 * Chuyển từ React: src/services/orderService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class OrderApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';

function normalizeOrderStatus(order: any = {}) {
  const raw = String(order.order_status || order.status || "").toLowerCase();
  if (raw === "cancelled") return "cancelled";
  if (raw === "shipping" || raw === "shipped") return "shipping";
  if (raw === "completed" || raw === "delivered") return "delivered";
  if (raw === "confirmed") return "processing";
  if (raw === "processing") return "processing";
  if (raw === "pending" || order.payment_status === "unpaid" || order.payment?.status === "PENDING" || order.payments?.some((payment: any) => payment.status === "pending")) {
    return "awaiting_payment";
  }
  return "processing";
}

function normalizePaymentMethod(order: any = {}) {
  const method = order.payments?.[0]?.payment_method || order.payment_method || order.paymentMethod;
  if (method === "online" || method === "ONLINE_MOCK") return "Thanh toán trực tuyến";
  if (method === "cod" || method === "COD") return "Thanh toán khi nhận hàng";
  if (method === "store" || method === "PAY_AT_STORE") return "Thanh toán tại cửa hàng";
  return method || "Đang cập nhật";
}

function parseVariantMeta(value: any = "") {
  const text = String(value || "").trim();
  if (!text || ["mac dinh", "mặc định", "default"].includes(text.toLocaleLowerCase("vi"))) {
    return { variant: "", size: "" };
  }

  const sizePattern = /\b(?:size\s*)?(XS|S|M|L|XL|XXL|\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|cm|mm))\b/i;
  const sizeMatch = text.match(sizePattern);
  const size = sizeMatch?.[0]?.trim() || "";
  const variant = size ? text.replace(sizeMatch![0], "").replace(/[-–—|,/]+/g, " ").trim() : text;

  return {
    variant: variant || (size ? "" : text),
    size,
  };
}

function normalizeOrderProduct(item: any = {}) {
  const itemName = item.name || item.nameSnapshot || item.item_name_snapshot || item.product?.product_name || "Sản phẩm";
  const [name, snapshotVariantName] = itemName.split(" - ");
  const variantName = item.variant?.variant_name || item.variant_name || item.variantSnapshot || snapshotVariantName || "";
  const parsedVariant = parseVariantMeta(variantName);

  return {
    id: String(item.orderItemId || item.order_item_id || item.productId || item.product_id || item.id || itemName),
    productId: item.productId || item.product_id,
    variantId: item.variantId ?? item.variant_id ?? item.variant?.variant_id ?? null,
    name,
    price: Number(item.unitPrice ?? item.unit_price ?? item.price ?? item.product?.price ?? 0),
    quantity: Number(item.quantity || 1),
    variant: item.variant_label || item.variantLabel || parsedVariant.variant,
    size: item.size || item.size_label || item.sizeLabel || parsedVariant.size,
    image: item.product?.product_images?.[0]?.image_url || item.image || item.photoUrl || "",
  };
}

export function normalizeOrder(order: any = {}) {
  const rawItems = Array.isArray(order.items) ? order.items : (Array.isArray(order.order_items) ? order.order_items : []);
  const products = rawItems.map(normalizeOrderProduct);
  const createdAt = order.created_at || order.createdAt || order.orderedAt || new Date().toISOString();
  const totalAmount = Number(order.total_amount ?? order.pricing?.totalAmount ?? order.totalAmount ?? 0);
  const shippingFee = Number(order.shipping_fee ?? order.pricing?.shippingFee ?? order.shippingFee ?? 0);
  const discount = Number(order.discount_amount ?? order.pricing?.voucherDiscount ?? order.discount ?? 0) + Number(order.points_discount_amount || 0);

  return {
    ...order,
    id: String(order.id || order._id || order.order_id || order.order_code || order.code || ""),
    code: order.code || order.order_code || "",
    status: normalizeOrderStatus(order),
    paymentMethod: normalizePaymentMethod(order),
    paymentExpiresAt: order.payment_expires_at || new Date(new Date(createdAt).getTime() + 15 * 60 * 1000).toISOString(),
    orderedAt: createdAt,
    estimatedDelivery: order.estimated_delivery_at || null,
    products,
    shippingFee,
    discount,
    totalAmount,
    recipient: {
      name: order.recipient_name || order.shippingAddress?.recipientName || order.shippingAddress?.fullName || order.contactSnapshot?.fullName || order.address?.recipient_name || "",
      phone: order.recipient_phone || order.shippingAddress?.phone || order.contactSnapshot?.phone || order.address?.recipient_phone || "",
      address: order.shipping_address || (order.shippingAddress ? [order.shippingAddress.line1, order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.city].filter(Boolean).join(", ") : "") || order.address?.address_line || "",
    },
  };
}

export function toCheckoutItems(items: any) {
  return items.map((item: any) => ({
    product_id: String(item.productId ?? item.product_id ?? item.id).split(":")[0],
    variant_id: item.variantId ?? item.variant_id ?? null,
    quantity: item.qty ?? item.quantity ?? 1,
  }));
}

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private readonly http = inject(CustomerHttpService);

  async checkoutOrder({ addressId, selectedAddress, paymentMethod, voucherCode, note, items, cartId }: any) {
    const address = selectedAddress || {};
    const payload: any = {
      addressId: addressId || undefined,
      cartId: cartId || undefined,
      shippingAddress: {
        fullName: address.fullName || address.receiverName || "Khách hàng",
        phone: address.phone || address.receiverPhone || "0912345678",
        addressLine: address.addressLine || address.address || address.street || "Địa chỉ nhận hàng",
        ward: address.ward || "",
        district: address.district || "",
        city: address.city || "Hồ Chí Minh",
      },
      paymentMethod: paymentMethod === "online" || paymentMethod === "ONLINE" ? "ONLINE_MOCK" : "COD",
      voucherCode: voucherCode || undefined,
      note: note || undefined,
      items: toCheckoutItems(items || []),
    };
    try {
      const response = await this.http.post("/orders/checkout", payload);
      return assertSuccess(response);
    } catch (err: any) {
      if (err?.status === 404) {
        const response = await this.http.post("/checkout", payload);
        return assertSuccess(response);
      }
      throw err;
    }
  }

  async guestCheckoutOrder({ guest, paymentMethod, voucherCode, note, items, cartId }: any) {
    const addressLine = [guest.address, guest.ward, guest.district, guest.city].filter(Boolean).join(", ");
    const payload: any = {
      cartId: cartId || undefined,
      contact: {
        fullName: guest.fullName || guest.name || "Khách vãng lai",
        phone: guest.phone,
        email: guest.email || undefined,
      },
      shippingAddress: {
        fullName: guest.fullName || guest.name || "Khách vãng lai",
        phone: guest.phone,
        addressLine: addressLine || guest.address || "Địa chỉ nhận hàng",
        ward: guest.ward || "",
        district: guest.district || "",
        city: guest.city || "Hồ Chí Minh",
      },
      paymentMethod: paymentMethod === "online" || paymentMethod === "ONLINE" ? "ONLINE_MOCK" : "COD",
      voucherCode: voucherCode || undefined,
      note: note || undefined,
      items: toCheckoutItems(items || []),
    };
    try {
      const response = await this.http.post("/orders/checkout", payload);
      return assertSuccess(response);
    } catch (err: any) {
      if (err?.status === 404) {
        const response = await this.http.post("/checkout", payload);
        return assertSuccess(response);
      }
      throw err;
    }
  }

  async getMyOrders(params: any = {}) {
    const response = await this.http.get("/orders", {
      params: { page: 1, limit: 100, ...params },
    });
    const payload = assertSuccess(response);
    const orders = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.orders)
        ? payload.orders
        : Array.isArray(payload)
          ? payload
          : [];
    return orders.map(normalizeOrder);
  }

  async getOrderDetails(orderId: any) {
    const response = await this.http.get(`/orders/${orderId}`);
    return normalizeOrder(assertSuccess(response));
  }

  async cancelOrder(orderId: any, reason: string = 'Khách hàng hủy đơn') {
    try {
      const response = await this.http.post(`/orders/${orderId}/cancel`, { reason });
      return assertSuccess(response);
    } catch {
      const response = await this.http.patch(`/orders/${orderId}/cancel`, { reason });
      return assertSuccess(response);
    }
  }

  async repayOrder(orderId: any, payload: any = {}) {
    const response = await this.http.post(`/orders/${orderId}/repay`, {
      payment_method: payload.paymentMethod || payload.payment_method || "online",
    });
    return assertSuccess(response);
  }

  async canReviewOrderProduct(productId: any) {
    const response = await this.http.get(`/reviews/can-review/product/${productId}`);
    const payload = assertSuccess(response);
  
    return {
      allowed: Boolean(payload),
      message:
        response?.EM ||
        (payload ? "Có thể đánh giá sản phẩm." : "Sản phẩm này hiện chưa thể đánh giá."),
    };
  }
}
