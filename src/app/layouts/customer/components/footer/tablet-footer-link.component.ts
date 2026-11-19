import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';

/**
 * TabletFooterLink — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'app-tablet-footer-link',
  standalone: true,
  imports: [NgTemplateOutlet, CustomerLinkDirective],
  templateUrl: './tablet-footer-link.component.html',
  styleUrl: './tablet-footer-link.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabletFooterLinkComponent {
  // --- Input / Output (props của React) ---
  readonly to = input<any>("#");
  readonly onClick = output<any>();
  /** true khi component cha có truyền (onClick) — thay cho kiểm tra "if (onClick)" của React */
  readonly hasOnClick = input<boolean>(false);

  // --- Giá trị tính toán (computed) ---
  readonly className = computed<any>(() => "block text-left font-['Roboto'] text-[15px] font-normal leading-[1.45] text-[#20262E] transition-colors hover:text-[#0D47A1]");

}
