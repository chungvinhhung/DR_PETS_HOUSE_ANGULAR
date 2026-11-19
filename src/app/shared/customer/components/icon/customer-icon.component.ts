import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { ReactStyleDirective } from '../../directives/react-style.directive';
import { CUSTOMER_ICONS } from './customer-icons';

/**
 * Icon SVG dùng chung cho Customer (thay <ChevronDown />, <UserOutlined /> ... của bản React).
 *
 * Cách dùng:
 *   <app-customer-icon name="chevron-down" className="h-4 w-4" />
 *   <app-customer-icon name="star" [size]="16" fill="#FDD835" [strokeWidth]="1.5" />
 *
 * Danh sách tên icon: xem customer-icons.ts.
 */
@Component({
  selector: 'app-customer-icon',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './customer-icon.component.html',
  styleUrl: './customer-icon.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<string>();
  readonly className = input<string | null | undefined>('');
  readonly size = input<number | string>(24);
  readonly strokeWidth = input<number | string>(2);
  readonly fill = input<string | null | undefined>(undefined);
  readonly color = input<string | null | undefined>(undefined);
  readonly svgStyle = input<Record<string, unknown> | null>(null);

  protected readonly definition = computed(() => {
    const icon = CUSTOMER_ICONS[this.name()];
    if (!icon) console.warn(`[app-customer-icon] Không có icon "${this.name()}" trong customer-icons.ts`);
    return icon ?? CUSTOMER_ICONS['circle'];
  });

  // Nội dung SVG là chuỗi tĩnh do dự án định nghĩa -> an toàn để bỏ qua sanitize.
  protected readonly body = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.definition().body));
}
