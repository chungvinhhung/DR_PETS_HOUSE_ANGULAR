import { ChangeDetectionStrategy, Component, computed, effect, signal, untracked } from '@angular/core';

import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { ScaledCanvasLayoutComponent } from '../../../../shared/customer/components/scaled-canvas-layout/scaled-canvas-layout.component';
import { FeedbackSectionComponent } from '../../../../shared/customer/components/feedback-section/feedback-section.component';
import { FooterComponent } from '../../../../layouts/customer/components/footer/footer.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { aboutDecorations, aboutDoctors, aboutGallerySlides, aboutMilestones, aboutServices, commitmentBenefits } from '../data/about-data';
import { imageUrl, figmaImageUrl, cx, containerClass, sectionTitleClass, primaryButtonClass, roundControlClass, serviceShapes } from './about-page.helpers';

const heroLogo = '/assets/customer/images/home/hero-logo.png';

/**
 * AboutPage — chuyển từ React: src/pages/About/AboutPage.jsx
 */
@Component({
  selector: 'div[app-about-page]',
  standalone: true,
  imports: [NavBarComponent, ScaledCanvasLayoutComponent, FeedbackSectionComponent, FooterComponent, CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './about-page.component.html',
  styleUrl: './about-page.component.scss',
  host: {
    'class': 'overflow-hidden bg-white font-sans text-[#0f172a]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutPageComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly figmaImageUrl: any = figmaImageUrl;
  protected readonly heroLogo: any = heroLogo;
  protected readonly primaryButtonClass: any = primaryButtonClass;
  protected readonly cx: any = cx;
  protected readonly imageUrl: any = imageUrl;
  protected readonly containerClass: any = containerClass;
  protected readonly sectionTitleClass: any = sectionTitleClass;
  protected readonly commitmentBenefits: any = commitmentBenefits;
  protected readonly roundControlClass: any = roundControlClass;
  protected readonly aboutDecorations: any = aboutDecorations;
  protected readonly aboutMilestones: any = aboutMilestones;
  protected readonly aboutServices: any = aboutServices;
  protected readonly serviceShapes: any = serviceShapes;

  // --- Giá trị tính toán (computed) ---
  readonly activeGallery = computed<any>(() => (aboutGallerySlides as any)[this.activeSpace()]);
  readonly previewImage = computed<any>(() => this.previewImageIndex() === null
      ? null
      : {
          src: (this.activeGallery().images as any)[this.previewImageIndex()],
          alt: `${this.activeGallery().title} - ảnh ${this.previewImageIndex() + 1}`,
        });
  readonly doctorPage = computed<any>(() => this.doctorSlide() % 2);
  readonly visibleDoctors = computed<any>(() => aboutDoctors.slice(this.doctorPage() * 4, this.doctorPage() * 4 + 4));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly activeSpace = signal<any>(0);
  readonly doctorSlide = signal<any>(0);
  readonly previewImageIndex = signal<any>(null);

  constructor() {
    // useEffect(..., [activeGallery.images.length, previewImageIndex])
    effect((onCleanup: any) => {
      this.activeGallery().images.length;
      this.previewImageIndex();
      const cleanup = untracked(() => {
        if (this.previewImageIndex() === null) return undefined;

        const handleKeyDown = (event: any) => {
          if (event.key === "Escape") this.closeSpacePreview();
          if (event.key === "ArrowLeft") this.movePreviewImage(-1);
          if (event.key === "ArrowRight") this.movePreviewImage(1);
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => window.removeEventListener("keydown", handleKeyDown);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected moveGallery(direction: any) {
    this.activeSpace.update((current: any) =>
      (current + direction + aboutGallerySlides.length) %
      aboutGallerySlides.length);
  }

  protected openSpacePreview(index: any) {
    this.previewImageIndex.set(index);
  }

  protected closeSpacePreview() {
    this.previewImageIndex.set(null);
  }

  protected movePreviewImage(direction: any) {
    this.previewImageIndex.update((current: any) => {
      if (current === null) return current;

      return (
        (current + direction + this.activeGallery().images.length) %
        this.activeGallery().images.length
      );
    });
  }

  protected moveDoctorSlide(direction: any) {
    this.doctorSlide.update((current: any) => (current + direction + 4) % 4);
  }

  protected handle3(event: any) {
    event.stopPropagation();
    this.movePreviewImage(-1);
  }

  protected handle4(event: any) {
    event.stopPropagation();
    this.movePreviewImage(1);
  }
}
