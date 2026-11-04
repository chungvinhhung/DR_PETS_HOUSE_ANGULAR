import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { DecisionModalService } from '../../../../core/customer/services/decision-modal.service';
import { CartService } from '../../../../core/customer/services/cart.service';
import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { CartApiService } from '../../../../core/customer/services/api/cart-api.service';
import { OrderApiService } from '../../../../core/customer/services/api/order-api.service';
import { ProductApiService } from '../../../../core/customer/services/api/product-api.service';
import { OrderPagesSearchAndSortComponent } from './order-pages-search-and-sort.component';
import { OrderCardComponent } from './order-card.component';
import { OrderReviewModalComponent } from './order-review-modal.component';
import { formatOrderDate, ORDERS, ORDER_FILTERS } from '../data/order-data';
import { buildCheckoutItemsFromOrder } from './order-pages-yellow-button.helpers';

/**
 * MyOrdersPage — chuyển từ React: src/pages/Order/OrderPages.jsx
 */
@Component({
  selector: 'div[app-my-orders-page]',
  standalone: true,
  imports: [OrderPagesSearchAndSortComponent, OrderCardComponent, OrderReviewModalComponent],
  templateUrl: './my-orders-page.component.html',
  host: {
    'class': 'mx-auto flex w-full max-w-[943px] flex-col gap-6 pb-10',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyOrdersPageComponent {
  // --- Service dùng chung ---
  protected readonly decisionModalService = inject(DecisionModalService);
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(CustomerAuthService);
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly cartApi = inject(CartApiService);
  protected readonly orderApi = inject(OrderApiService);
  protected readonly productApi = inject(ProductApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly ORDER_FILTERS: any = ORDER_FILTERS;

  // --- Giá trị tính toán (computed) ---
  readonly orders = computed<any>(() => {
    const normalizedSearch = this.searchQuery().trim().toLocaleLowerCase("vi");
    const result = this.ordersData().filter((order: any) => {
      if (this.filter() !== "all" && order.status !== this.filter()) return false;
      if (!normalizedSearch) return true;
      const searchableText = [
        order.id,
        formatOrderDate(order.orderedAt),
        ...(Array.isArray(order.products) ? order.products.map((product: any) => product.name) : []),
      ]
        .join(" ")
        .toLocaleLowerCase("vi");
      return searchableText.includes(normalizedSearch);
    });

    return [...result].sort((a: any, b: any) =>
      this.sortOrder() === "oldest"
        ? Number(new Date(a.orderedAt)) - Number(new Date(b.orderedAt))
        : Number(new Date(b.orderedAt)) - Number(new Date(a.orderedAt)),
    );
  });

  // --- Trạng thái (signal = useState / useRef) ---
  readonly ordersData = signal<any>([]);
  readonly filter = signal<any>("all");
  readonly searchInput = signal<any>("");
  readonly searchQuery = signal<any>("");
  readonly sortOrder = signal<any>("newest");
  readonly isLoading = signal<any>(true);
  readonly loadError = signal<any>("");
  readonly activeOrderId = signal<any>("");
  readonly actionFeedback = signal<any>({});
  readonly reviewOrderId = signal<any>("");
  readonly reviewableProducts = signal<any>([]);
  readonly reviewEligibilityLoading = signal<any>(false);

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");

        this.orderApi.getMyOrders()
          .then((orders: any) => {
            if (active) {
              const list = Array.isArray(orders) ? orders : [];
              this.ordersData.set(list);
            }
          })
          .catch((error: any) => {
            if (!active) return;
            if (this.authService.isAuthenticated()) {
              this.ordersData.set([]);
              this.loadError.set(error?.message || "Không thể tải danh sách đơn hàng của bạn.");
            } else {
              this.ordersData.set(ORDERS);
              this.loadError.set(error?.message || "Không thể tải danh sách đơn hàng, đang hiển thị dữ liệu mẫu.");
            }
          })
          .finally(() => {
            if (active) this.isLoading.set(false);
          });

        return () => {
          active = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

  protected updateActionFeedback(orderId: any, message: any, type: any = "info") {
    this.actionFeedback.update((current: any) => ({
      ...current,
      [orderId]: { message, type },
    }));
  }

  protected async handleReorder(order: any) {
    const validItems = buildCheckoutItemsFromOrder(order);
    if (!validItems.length) {
      this.updateActionFeedback(order.id, "Không thể đặt lại vì đơn hàng này không còn dữ liệu sản phẩm hợp lệ.", "error");
      return;
    }

    this.activeOrderId.set(order.id);
    this.updateActionFeedback(order.id, "");

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

      this.updateActionFeedback(order.id, "Đã chuyển sang thanh toán với sản phẩm của đơn cũ.");
      this.navService.navigate("/checkout");
    } catch (error: any) {
      this.updateActionFeedback(order.id, error?.message || "Không thể thêm lại sản phẩm vào giỏ hàng.", "error");
    } finally {
      this.activeOrderId.set("");
    }
  }

  protected async handleCancelOrder(order: any) {
    this.decisionModalService.confirmCancel({
      message: `Bạn chắc chắn muốn hủy đơn hàng #${order.id}?\nHành động này không thể hoàn tác`,
      confirmLabel: "Hủy",
      onConfirm: async () => {
        this.activeOrderId.set(order.id);
        this.updateActionFeedback(order.id, "");

        try {
          await this.orderApi.cancelOrder(order.id);
          this.ordersData.update((current: any) =>
            current.map((item: any) =>
              item.id === order.id
                ? {
                    ...item,
                    status: "cancelled",
                    order_status: "cancelled",
                  }
                : item,
            ));
          this.updateActionFeedback(order.id, "Đã hủy đơn hàng thành công.");
          this.decisionModalService.showSuccessModal({
            message: "Đã hủy đơn hàng thành công.\nBạn có thể tiếp tục hoặc quay về trang chủ",
          });
        } catch (error: any) {
          this.updateActionFeedback(order.id, error?.message || "Không thể hủy đơn hàng lúc này.", "error");
        } finally {
          this.activeOrderId.set("");
        }
      },
    });
  }

  protected async handleRepayOrder(order: any) {
    this.activeOrderId.set(order.id);
    this.updateActionFeedback(order.id, "");

    try {
      const result = await this.orderApi.repayOrder(order.id, { paymentMethod: "online" });
      if (result?.payment_url) {
        window.open(result.payment_url, "_blank", "noopener,noreferrer");
      }
      this.updateActionFeedback(order.id, "Đã tạo yêu cầu thanh toán lại. Cửa sổ thanh toán đã được mở.");
    } catch (error: any) {
      this.updateActionFeedback(order.id, error?.message || "Không thể tạo yêu cầu thanh toán lại.", "error");
    } finally {
      this.activeOrderId.set("");
    }
  }

  protected async handleOpenReview(order: any) {
    this.reviewOrderId.set(order.id);
    this.reviewEligibilityLoading.set(true);
    this.reviewableProducts.set([]);
    this.updateActionFeedback(order.id, "");

    try {
      const eligibilityResults = await Promise.all(
        order.products.map(async (product: any) => {
          if (!product.productId) {
            return { ...product, allowed: false };
          }

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
        this.updateActionFeedback(order.id, firstReason || "Đơn hàng này hiện chưa có sản phẩm nào có thể đánh giá.", "error");
      }
    } finally {
      this.reviewEligibilityLoading.set(false);
    }
  }

  protected async handleReviewSubmit({ targetId, rating, review }: any) {
    if (!this.reviewOrderId()) return;

    if (!targetId || !rating) {
      this.updateActionFeedback(this.reviewOrderId(), "Vui lòng chọn số sao trước khi gửi đánh giá.", "error");
      return;
    }

    this.activeOrderId.set(this.reviewOrderId());

    try {
      await this.productApi.createProductReview(targetId, { rating, content: review });
      const submittedProduct = this.reviewableProducts().find(
        (product: any) => String(product.productId) === String(targetId),
      );
      const remainingProducts = this.reviewableProducts().filter(
        (product: any) => String(product.productId) !== String(targetId),
      );

      this.reviewableProducts.set(remainingProducts);
      this.updateActionFeedback(
        this.reviewOrderId(),
        `Đã gửi đánh giá cho sản phẩm ${submittedProduct?.name || ""}`.trim(),
      );

      if (!remainingProducts.length) {
        this.reviewOrderId.set("");
      }
    } catch (error: any) {
      this.updateActionFeedback(this.reviewOrderId(), error?.message || "Không thể gửi đánh giá lúc này.", "error");
    } finally {
      this.activeOrderId.set("");
    }
  }

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected compute2(value: any): any {
    return value === "all" ? this.ordersData().length : this.ordersData().filter((order: any) => order.status === value).length;
  }

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected compute3(): any {
    return this.ordersData().find((order: any) => order.id === this.reviewOrderId()) || { id: this.reviewOrderId(), products: [] };
  }
}
