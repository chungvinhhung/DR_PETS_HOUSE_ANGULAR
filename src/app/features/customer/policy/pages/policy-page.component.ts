import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { CanvasLayoutComponent } from '../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { BreadcrumbComponent } from '../../../../shared/customer/components/breadcrumb/breadcrumb.component';
import { PolicyArticleComponent } from './policy-article.component';
import { PolicyRelatedSidebarComponent } from './policy-related-sidebar.component';
import { PolicySupportCtaComponent } from './policy-support-cta.component';
import { FooterComponent } from '../../../../layouts/customer/components/footer/footer.component';
import { getPolicyDetail } from '../data/policy-data';

/**
 * PolicyPage — chuyển từ React: src/pages/Policy/PolicyPage.jsx
 */
@Component({
  selector: 'div[app-policy-page]',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, BreadcrumbComponent, PolicyArticleComponent, PolicyRelatedSidebarComponent, PolicySupportCtaComponent, FooterComponent],
  templateUrl: './policy-page.component.html',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyPageComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);

  // --- Giá trị tính toán (computed) ---
  readonly policy = computed<any>(() => getPolicyDetail(this.navService.params()['slug']));

}
