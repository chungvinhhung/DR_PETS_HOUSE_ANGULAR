import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { ContentApiService } from '../../../../../core/customer/services/api/content-api.service';
import { CanvasLayoutComponent } from '../../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { BreadcrumbComponent } from '../../../../../shared/customer/components/breadcrumb/breadcrumb.component';
import { EmergencySupportComponent } from './emergency-support.component';
import { StepSectionComponent } from './step-section.component';
import { VideoSectionComponent } from './video-section.component';
import { RelatedSectionComponent } from './related-section.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { FIRST_AID_POSTS, getFirstAidDetail } from '../../../../../shared/customer/data/first-aid-data';

/**
 * FirstAidDetailPage — chuyển từ React: src/pages/Blog/FirstAidDetailPage.jsx
 */
@Component({
  selector: 'div[app-first-aid-detail-page]',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, BreadcrumbComponent, EmergencySupportComponent, StepSectionComponent, VideoSectionComponent, RelatedSectionComponent, FooterComponent, CustomerIconComponent],
  templateUrl: './first-aid-detail-page.component.html',
  styleUrl: './first-aid-detail-page.component.scss',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstAidDetailPageComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly contentApi = inject(ContentApiService);

  // --- Giá trị tính toán (computed) ---
  readonly fallbackDetail = computed<any>(() => getFirstAidDetail(this.navService.params()['postId']));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly detail = signal<any>(this.fallbackDetail());
  readonly relatedPosts = signal<any>(FIRST_AID_POSTS);
  readonly isLoading = signal<any>(false);
  readonly loadError = signal<any>("");

  constructor() {
    // useEffect(..., [fallbackDetail, postId])
    effect((onCleanup: any) => {
      this.fallbackDetail();
      this.navService.params()['postId'];
      const cleanup = untracked(() => {
        let active = true;
        this.detail.set(this.fallbackDetail());
        this.isLoading.set(true);
        this.loadError.set("");

        Promise.all([
          this.contentApi.getFirstAidGuideBySlug(this.navService.params()['postId']),
          this.contentApi.getFirstAidGuidesPage({ limit: 12 }),
        ])
          .then(([apiDetail, apiGuides]: any) => {
            if (!active) return;
            this.detail.set(apiDetail);
            if (apiGuides.guides.length) {
              this.relatedPosts.set(apiGuides.guides.filter((item: any) => item.id !== apiDetail.id));
            }
          })
          .catch((error: any) => {
            if (!active) return;
            this.loadError.set(error?.message || "Không thể tải hướng dẫn sơ cứu, đang hiển thị dữ liệu mẫu từ giao diện.");
          })
          .finally(() => {
            if (active) this.isLoading.set(false);
          });

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

}
