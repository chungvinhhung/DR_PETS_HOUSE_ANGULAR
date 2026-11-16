import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ProductCardComponent } from '../product-card/product-card.component';

/**
 * ShoppingProductCard — chuyển từ React: src/components/product/ShoppingProductCard.jsx
 *
 * Bọc ProductCard: tự chọn kiểu thẻ "tag" (có nhãn giảm giá) nếu sản phẩm có discount/tag,
 * và thêm class "shopping-product-card".
 */
@Component({
  selector: 'app-shopping-product-card',
  standalone: true,
  imports: [ProductCardComponent],
  templateUrl: './shopping-product-card.component.html',
  styleUrl: './shopping-product-card.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingProductCardComponent {
  readonly className = input<any>('');
  readonly product = input<any>(undefined);
  readonly variant = input<any>(undefined);
  readonly name = input<any>(undefined);
  readonly price = input<any>(undefined);
  readonly oldPrice = input<any>(undefined);
  readonly tagLabel = input<any>(undefined);
  readonly imageSrc = input<any>(undefined);
  readonly rating = input<any>(undefined);
  readonly href = input<any>(undefined);
  readonly onAddToCart = output<any>();

  protected readonly resolvedVariant = computed(() => {
    const product = this.product();
    return this.variant() || (product?.discountPercent || product?.tagLabel || product?.discountLabel ? 'tag' : 'default');
  });

  protected readonly classes = computed(() => ['shopping-product-card', this.className()].filter(Boolean).join(' '));
}
