import { computed, Directive, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { CustomerNavigationService } from '../../../core/customer/services/customer-navigation.service';

/**
 * Thay cho <Link to="..."> và <NavLink to="..."> của react-router.
 *
 * - Nhận nguyên chuỗi URL (có thể kèm ?query và #hash), ví dụ: "/san-pham?category=do-choi".
 * - Click trái bình thường -> điều hướng SPA bằng Router (không tải lại trang).
 *   Ctrl/Cmd + click, chuột giữa, target=_blank -> để trình duyệt xử lý như link thường.
 * - exportAs "customerLink": dùng để biết link có đang active không (giống NavLink isActive):
 *     <a appCustomerLink="/blog" #link="customerLink" [class]="link.isActive() ? 'active' : ''">
 */
@Directive({
  selector: 'a[appCustomerLink]',
  standalone: true,
  exportAs: 'customerLink',
  host: {
    '[attr.href]': 'appCustomerLink()',
    '[attr.aria-current]': 'isActive() ? "page" : null',
    '(click)': 'onClick($event)',
  },
})
export class CustomerLinkDirective {
  private readonly router = inject(Router);
  private readonly nav = inject(CustomerNavigationService);

  readonly appCustomerLink = input<string>('');
  /** Giống prop `end` của NavLink: chỉ active khi đường dẫn trùng khớp hoàn toàn. */
  readonly exact = input<boolean>(false);
  readonly replaceUrl = input<boolean>(false);
  readonly linkState = input<unknown>(undefined);

  readonly isActive = computed(() => {
    const target = (this.appCustomerLink() || '').split(/[?#]/)[0] || '/';
    const current = this.nav.location().pathname;
    if (this.exact() || target === '/') return current === target;
    return current === target || current.startsWith(target.replace(/\/$/, '') + '/');
  });

  protected onClick(event: MouseEvent): void {
    const url = this.appCustomerLink();
    const anchor = event.currentTarget as HTMLAnchorElement | null;
    if (!url || /^(https?:|mailto:|tel:)/.test(url)) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (anchor?.target && anchor.target !== '_self') return;
    event.preventDefault();
    void this.router.navigateByUrl(url, {
      replaceUrl: this.replaceUrl(),
      state: this.linkState() as Record<string, unknown> | undefined,
    });
  }
}
