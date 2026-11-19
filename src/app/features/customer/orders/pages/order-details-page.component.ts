import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { DecisionModalService } from '../../../../core/customer/services/decision-modal.service';
import { CartService } from '../../../../core/customer/services/cart.service';
import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { CartApiService } from '../../../../core/customer/services/api/cart-api.service';
import { OrderApiService } from '../../../../core/customer/services/api/order-api.service';
import { ProductApiService } from '../../../../core/customer/services/api/product-api.service';
import { ProductSummaryComponent } from './product-summary.component';
import { OrderPagesYellowButtonComponent } from './order-pages-yellow-button.component';
import { OutlineButtonComponent } from './outline-button.component';
import { InvoiceModalComponent } from './invoice-modal.component';
import { OrderReviewModalComponent } from './order-review-modal.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { formatCurrency, formatOrderDate, getOrderSubtotal, getOrderTotal, ORDERS, ORDER_STATUS } from '../data/order-data';
import { STATUS_STEPS, buildCheckoutItemsFromOrder, getStepDateLabel } from './order-pages-yellow-button.helpers';

/**
 * OrderDetailsPage — chuyển từ React: src/pages/Order/OrderPages.jsx
 */
@Component({
  selector: 'app-order-details-page',
  standalone: true,
  imports: [ProductSummaryComponent, OrderPagesYellowButtonComponent, OutlineButtonComponent, InvoiceModalComponent, OrderReviewModalComponent, ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './order-details-page.component.html',
  styleUrl: './order-details-page.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsPageComponent {
  // --- Service dùng chung ---
  protected readonly decisionModalService = inject(DecisionModalService);
  protected readonly cartService = inject(CartService);
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly cartApi = inject(CartApiService);
  protected readonly orderApi = inject(OrderApiService);
  protected readonly productApi = inject(ProductApiService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly formatOrderDate: any = formatOrderDate;
  protected readonly STATUS_STEPS: any = STATUS_STEPS;
  protected readonly ORDER_STATUS: any = ORDER_STATUS;
  protected readonly getStepDateLabel: any = getStepDateLabel;
  protected readonly getOrderSubtotal: any = getOrderSubtotal;
  protected readonly formatCurrency: any = formatCurrency;
  protected readonly getOrderTotal: any = getOrderTotal;

  // --- Giá trị tính toán (computed) ---
  readonly activeStep = computed<any>(() => STATUS_STEPS.indexOf(this.order().status));
  readonly currentStatus = computed<any>(() => (ORDER_STATUS as any)[this.order().status] || ORDER_STATUS.processing);
  readonly orderProducts = computed<any>(() => Array.isArray(this.order().products) ? this.order().products : []);
  readonly detailActions = computed<any>(() => {
    const detailActions: any = [];
    if (this.order().status === "awaiting_payment") {
        detailActions.push({
          key: "repay",
          label: "Thanh toán",
          onClick: this.handleRepay.bind(this),
          variant: "yellow",
          disabled: this.paymentExpired(),
        });
      } else if (this.order().status === "processing") {
        detailActions.push({
          key: "cancel",
          label: "Hủy đơn",
          onClick: this.handleCancel.bind(this),
          variant: "danger",
        });
      } else if (this.order().status === "delivered") {
        detailActions.push({
          key: "review",
          label: "Đánh giá",
          onClick: this.handleOpenReview.bind(this),
          variant: "yellow",
        });
        detailActions.push({
          key: "reorder",
          label: "Đặt lại",
          onClick: this.handleReorder.bind(this),
          variant: "outline",
        });
      } else {
        detailActions.push({
          key: "reorder",
          label: "Đặt lại",
          onClick: this.handleReorder.bind(this),
          variant: "outline",
        });
      }
    return detailActions;
  });

  // --- Trạng thái (signal = useState / useRef) ---
  readonly invoiceOpen = signal<any>(false);
  readonly order = signal<any>(null);
  readonly isLoading = signal<any>(true);
  readonly loadError = signal<any>("");
  readonly actionLoading = signal<any>(false);
  readonly actionMessage = signal<any>(null);
  readonly reviewableProducts = signal<any>([]);
  readonly reviewEligibilityLoading = signal<any>(false);
  readonly reviewOpen = signal<any>(false);
  readonly paymentExpired = signal<any>(false);

  constructor() {
    // useEffect(..., [orderId])
    effect((onCleanup: any) => {
      this.navService.params()['orderId'];
      const cleanup = untracked(() => {
        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");

        this.orderApi.getOrderDetails(this.navService.params()['orderId'])
          .then(async (detail: any) => {
            if (!active) return;
            this.order.set(detail);

            if (detail?.products?.length) {
              const needsImg = detail.products.some((p: any) => !p.image || p.image.includes('detail-image'));
              if (needsImg) {
                const updatedProducts = await Promise.all(detail.products.map(async (p: any) => {
                  if ((!p.image || p.image.includes('detail-image')) && p.productId) {
                    try {
                      const prod = await this.productApi.getProductDetails(p.productId);
                      if (prod?.image) return { ...p, image: prod.image };
                    } catch {}
                  }
                  return p;
                }));
                if (active) {
                  this.order.update((curr: any) => curr ? { ...curr, products: updatedProducts } : curr);
                }
              }
            }
          })
          .catch((error: any) => {
            if (!active) return;
            const fallbackOrder = ORDERS.find((item: any) => String(item.id) === String(this.navService.params()['orderId'])) || ORDERS[0] || null;
            this.order.set(fallbackOrder);
            this.loadError.set(error?.message || "Không thể tải chi tiết đơn hàng, đang hiển thị dữ liệu mẫu.");
          })
          .finally(() => {
            if (active) this.isLoading.set(false);
          });

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [order?.paymentExpiresAt, order?.status])
    effect((onCleanup: any) => {
      this.order()?.paymentExpiresAt;
      this.order()?.status;
      const cleanup = untracked(() => {
        if (this.order()?.status !== "awaiting_payment") {
          this.paymentExpired.set(false);
          return undefined;
        }

        const updateExpired = () => {
          this.paymentExpired.set(new Date(this.order().paymentExpiresAt).getTime() <= Date.now());
        };
        updateExpired();
        const intervalId = window.setInterval(updateExpired, 1000);
        return () => window.clearInterval(intervalId);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected async handleReorder() {
    const validItems = buildCheckoutItemsFromOrder(this.order());
    if (!validItems.length) {
      this.actionMessage.set({ type: "error", text: "Không thể đặt lại vì đơn hàng này không còn dữ liệu sản phẩm hợp lệ." });
      return;
    }

    this.actionLoading.set(true);
    this.actionMessage.set(null);

    try {
      this.cartService.replaceCartItemsForCheckout(validItems);
      Promise.all(
        validItems.map((product: any) =>
          this.cartApi.addCartItem({
            productId: product.productId,
            variantId: product.variantId,
            qty: product.qty,
            size: product.size,
          }),
        ),
      ).catch(() => {});
      this.actionMessage.set({ type: "success", text: "Đã chuyển sang thanh toán với sản phẩm của đơn cũ." });
      this.navService.navigate("/checkout");
    } catch (error: any) {
      this.actionMessage.set({
        type: "error",
        text: error?.message || "Không thể thêm lại sản phẩm vào giỏ hàng.",
      });
    } finally {
      this.actionLoading.set(false);
    }
  }

  protected async handleCancel() {
    this.decisionModalService.confirmCancel({
      message: `Bạn chắc chắn muốn hủy đơn hàng #${this.order().id}?\nHành động này không thể hoàn tác`,
      confirmLabel: "Hủy",
      onConfirm: async () => {
        this.actionLoading.set(true);
        this.actionMessage.set(null);

        try {
          await this.orderApi.cancelOrder(this.order().id);
          this.order.update((current: any) =>
            current
              ? {
                  ...current,
                  status: "cancelled",
                  order_status: "cancelled",
                }
              : current);
          this.actionMessage.set({ type: "success", text: "Đã hủy đơn hàng thành công." });
          this.decisionModalService.showSuccessModal({
            message: "Đã hủy đơn hàng thành công.\nBạn có thể tiếp tục hoặc quay về trang chủ",
          });
        } catch (error: any) {
          this.actionMessage.set({
            type: "error",
            text: error?.message || "Không thể hủy đơn hàng lúc này.",
          });
        } finally {
          this.actionLoading.set(false);
        }
      },
    });
  }

  protected async handleRepay() {
    if (this.paymentExpired()) {
      this.actionMessage.set({ type: "error", text: "Đơn hàng đã hết thời gian thanh toán." });
      return;
    }

    this.actionLoading.set(true);
    this.actionMessage.set(null);

    try {
      const result = await this.orderApi.repayOrder(this.order().id, { paymentMethod: "online" });
      if (result?.payment_url) {
        window.open(result.payment_url, "_blank", "noopener,noreferrer");
      }
      this.actionMessage.set({
        type: "success",
        text: "Đã tạo yêu cầu thanh toán lại. Cửa sổ thanh toán đã được mở.",
      });
    } catch (error: any) {
      this.actionMessage.set({
        type: "error",
        text: error?.message || "Không thể tạo yêu cầu thanh toán lại.",
      });
    } finally {
      this.actionLoading.set(false);
    }
  }

  protected async handleOpenReview() {
    this.reviewOpen.set(true);
    this.reviewEligibilityLoading.set(true);
    this.reviewableProducts.set([]);
    this.actionMessage.set(null);

    try {
      const eligibilityResults = await Promise.all(
        (this.order()?.products || []).map(async (product: any) => {
          if (!product.productId) return { ...product, allowed: false };

          try {
            const eligibility = await this.orderApi.canReviewOrderProduct(product.productId);
            return { ...product, allowed: eligibility.allowed, message: eligibility.message };
          } catch (error: any) {
            return {
              ...product,
              allowed: false,
              message: error?.message || "Không thể kiểm tra quyền đánh giá.",
            };
          }
        }),
      );

      const allowedProducts = eligibilityResults.filter((product: any) => product.allowed);
      this.reviewableProducts.set(allowedProducts);

      if (!allowedProducts.length) {
        const firstReason = eligibilityResults.find((product: any) => product.message)?.message;
        this.actionMessage.set({
          type: "error",
          text: firstReason || "Đơn hàng này hiện chưa có sản phẩm nào có thể đánh giá.",
        });
      }
    } finally {
      this.reviewEligibilityLoading.set(false);
    }
  }

  protected async handleReviewSubmit({ targetId, rating, review }: any) {
    if (!targetId || !rating) {
      this.actionMessage.set({ type: "error", text: "Vui lòng chọn số sao trước khi gửi đánh giá." });
      return;
    }

    this.actionLoading.set(true);
    this.actionMessage.set(null);

    try {
      await this.productApi.createProductReview(targetId, { rating, content: review });
      const submittedProduct = this.reviewableProducts().find(
        (product: any) => String(product.productId) === String(targetId),
      );
      const remainingProducts = this.reviewableProducts().filter(
        (product: any) => String(product.productId) !== String(targetId),
      );

      this.reviewableProducts.set(remainingProducts);
      this.actionMessage.set({
        type: "success",
        text: `Đã gửi đánh giá cho sản phẩm ${submittedProduct?.name || ""}`.trim(),
      });

      if (!remainingProducts.length) {
        this.reviewOpen.set(false);
      }
    } catch (error: any) {
      this.actionMessage.set({
        type: "error",
        text: error?.message || "Không thể gửi đánh giá lúc này.",
      });
    } finally {
      this.actionLoading.set(false);
    }
  }

  /** (tự sinh) global Math không dùng trực tiếp được trong template */
  protected styles1(): any {
    return { width: `${Math.max(0, this.activeStep()) / (STATUS_STEPS.length - 1) * 100}%` };
  }
}
