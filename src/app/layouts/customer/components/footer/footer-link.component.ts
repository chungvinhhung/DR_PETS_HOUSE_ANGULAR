import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';

/**
 * FooterLink — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'li[app-footer-link]',
  standalone: true,
  imports: [NgTemplateOutlet, CustomerLinkDirective],
  templateUrl: './footer-link.component.html',
  host: {
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterLinkComponent {
  // --- Input / Output (props của React) ---
  readonly onClick = output<any>();
  readonly to = input<any>("#");
  /** true khi component cha có truyền (onClick) — thay cho kiểm tra "if (onClick)" của React */
  readonly hasOnClick = input<boolean>(false);

  // --- Giá trị tính toán (computed) ---
  readonly className = computed<any>(() => "inline-flex py-3 text-left text-[16px] leading-[1.4] text-[rgba(0,0,0,0.87)] transition-colors hover:text-[#0D47A1]");

}
