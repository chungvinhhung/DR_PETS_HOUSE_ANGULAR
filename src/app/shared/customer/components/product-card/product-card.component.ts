import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { ProductRatingComponent } from '../product-rating/product-rating.component';
import { CustomerLinkDirective } from '../../directives/customer-link.directive';
import { productCardImages } from '../../assets/product-card-assets';
import { getNumericPrice } from '../../utils/currency';
import { getFirstValue, formatProductPrice, buildProductHref } from './product-card.helpers';

/**
 * ProductCard — chuyển từ React: src/components/product/ProductCard.jsx
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [ProductRatingComponent, CustomerLinkDirective],
  templateUrl: './product-card.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCardComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);

  // --- Input / Output (props của React) ---
  readonly product = input<any>(undefined);
  readonly variant = input<any>("default");
  readonly name = input<any>(undefined);
  readonly price = input<any>(undefined);
  readonly oldPrice = input<any>(undefined);
  readonly tagLabel = input<any>(undefined);
  readonly imageSrc = input<any>(undefined);
  readonly rating = input<any>(undefined);
  readonly className = input<any>("");
  readonly href = input<any>(undefined);
  readonly onAddToCart = output<any>();
  /** true khi component cha có truyền (onAddToCart) — thay cho kiểm tra "if (onAddToCart)" của React */
  readonly hasOnAddToCart = input<boolean>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly productCardImages: any = productCardImages;

  // --- Giá trị tính toán (computed) ---
  readonly productName = computed<any>(() => getFirstValue(
    this.name(),
    this.product()?.name,
    this.product()?.productName,
    this.product()?.title,
    "Sản phẩm",
  ));
  readonly currentPriceValue = computed<any>(() => getFirstValue(this.price(), this.product()?.salePrice, this.product()?.currentPrice, this.product()?.price));
  readonly oldPriceValue = computed<any>(() => getFirstValue(
    this.oldPrice(),
    this.product()?.oldPrice,
    this.product()?.originalPrice,
    this.product()?.regularPrice,
    this.product()?.compareAtPrice,
    this.product()?.listPrice,
    this.product()?.salePrice || this.product()?.currentPrice ? this.product()?.price : undefined,
  ));
  readonly productPrice = computed<any>(() => formatProductPrice(this.currentPriceValue()));
  readonly productOldPrice = computed<any>(() => this.oldPriceValue() !== undefined &&
    this.oldPriceValue() !== null &&
    this.oldPriceValue() !== "" &&
    getNumericPrice(this.oldPriceValue()) > getNumericPrice(this.currentPriceValue())
      ? formatProductPrice(this.oldPriceValue())
      : "");
  readonly productRating = computed<any>(() => getFirstValue(this.rating(), this.product()?.rating, this.product()?.averageRating, 0));
  readonly productImage = computed<any>(() => getFirstValue(
    this.imageSrc(),
    this.product()?.imageSrc,
    this.product()?.image,
    this.product()?.imageUrl,
    this.product()?.thumbnail,
    productCardImages.placeholder,
  ));
  readonly productTagLabel = computed<any>(() => getFirstValue(
    this.tagLabel(),
    this.product()?.tagLabel,
    this.product()?.discountLabel,
    this.product()?.discountPercent ? `${this.product().discountPercent}% OFF` : undefined,
  ));
  readonly productHref = computed<any>(() => buildProductHref(this.product(), this.href()));
  readonly isTag = computed<any>(() => this.variant() === "tag" && this.productTagLabel());
  readonly forceHoverStyle = computed<any>(() => this.variant() === "hover");
  readonly cardClass = computed<any>(() => ([
    this.forceHoverStyle() ? "card-product" : "card-product-interactive",
    this.forceHoverStyle()
      ? "shadow-[0px_0px_15px_0px_#90CAF9,5px_4px_4px_0px_rgba(0,0,0,0.25)]"
      : "",
    this.className(),
  ]
    .filter(Boolean) as any[])
    .join(" "));

  protected handleAddToCart() {
    if (this.hasOnAddToCart()) {
      this.onAddToCart.emit(this.product());
    } else {
      this.cartService.addToCart({
        id: getFirstValue(this.product()?.id, this.product()?.productId, this.product()?.slug, `${this.productName()}:${this.productPrice()}`),
        productId: getFirstValue(this.product()?.productId, this.product()?.id),
        variantId: getFirstValue(this.product()?.variantId, this.product()?.variants?.[0]?.id, this.product()?.variants?.[0]?._id),
        variants: this.product()?.variants,
        name: this.productName(),
        price: this.currentPriceValue() ?? 0,
        image: this.productImage(),
        type: getFirstValue(this.product()?.type, this.product()?.variantName, ""),
        size: getFirstValue(this.product()?.size, ""),
        qty: 1,
      });
      this.cartService.openCart();
    }
  }

  protected handle1(event: any) {
    event.preventDefault();
    event.stopPropagation();
    this.handleAddToCart();
  }

  protected handle2(event: any) {
    event.preventDefault();
    event.stopPropagation();
    this.handleAddToCart();
  }
}
