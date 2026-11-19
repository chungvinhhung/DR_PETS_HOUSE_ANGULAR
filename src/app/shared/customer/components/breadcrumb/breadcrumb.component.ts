import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CustomerLinkDirective } from '../../directives/customer-link.directive';
import { productImages } from '../../assets/product-images';

/**
 * Breadcrumb — chuyển từ React: src/components/layout/Breadcrumb.jsx
 */
@Component({
  selector: 'nav[app-breadcrumb]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss',
  host: {
    'aria-label': 'Đường dẫn điều hướng',
    '[class]': '`flex ${ isBlog() ? \'min-h-9 items-center bg-transparent py-1 text-[13px] font-medium leading-[20px]\' : \'h-[56px] items-end bg-white px-[120px] text-[16px] leading-[24px]\' } ${className()}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  // --- Input / Output (props của React) ---
  readonly items = input<any>(undefined);
  readonly className = input<any>("");
  readonly listClassName = input<any>("");
  readonly linkClassName = input<any>("");
  readonly currentClassName = input<any>("");
  readonly separatorClassName = input<any>("");
  readonly variant = input<any>("default");

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly productImages: any = productImages;

  // --- Giá trị tính toán (computed) ---
  readonly isBlog = computed<any>(() => this.variant() === "blog");

}
