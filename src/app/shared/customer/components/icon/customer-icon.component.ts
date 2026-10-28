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
  template: `
    @if (definition().kind === 'fill') {
      <span role="img" [attr.class]="'anticon ' + (className() || '')" [appStyle]="svgStyle()">
        <svg [attr.viewBox]="definition().viewBox" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false" [innerHTML]="body()"></svg>
      </span>
    } @else {
      <svg
        xmlns="http://www.w3.org/2000/svg"
        [attr.class]="'lucide lucide-' + name() + ' ' + (className() || '')"
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.viewBox]="definition().viewBox"
        [attr.fill]="fill() || 'none'"
        [attr.stroke]="color() || 'currentColor'"
        [attr.stroke-width]="strokeWidth()"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        [appStyle]="svgStyle()"
        [innerHTML]="body()"
      ></svg>
    }
  `,
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
