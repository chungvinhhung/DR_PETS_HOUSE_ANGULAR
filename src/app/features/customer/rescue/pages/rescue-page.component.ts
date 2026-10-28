import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { RescueApiService } from '../../../../core/customer/services/api/rescue-api.service';
import { CanvasLayoutComponent } from '../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { SectionLabelComponent } from './section-label.component';
import { RescuePetCardComponent } from './rescue-pet-card.component';
import { AdoptionRequestCardComponent } from './adoption-request-card.component';
import { PartnerCardComponent } from './partner-card.component';
import { FooterComponent } from '../../../../layouts/customer/components/footer/footer.component';
import { AdoptionApplicationModalComponent } from '../components/adoption-application-modal.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { rescueImages } from '../../../../shared/customer/assets/rescue-images';
import { RESCUE_PARTNERS, RESCUE_PETS } from '../data/rescue-data';
import { normalizeAdoptionRequest } from '../../../../core/customer/services/api/rescue-api.service';
import { RESCUE_PAGE_SIZE } from './rescue-page.helpers';

/**
 * RescuePage — chuyển từ React: src/pages/Rescue/RescuePage.jsx
 */
@Component({
  selector: 'div[app-rescue-page]',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, SectionLabelComponent, RescuePetCardComponent, AdoptionRequestCardComponent, PartnerCardComponent, FooterComponent, AdoptionApplicationModalComponent, CustomerIconComponent],
  templateUrl: './rescue-page.component.html',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RescuePageComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);
  protected readonly rescueApi = inject(RescueApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly rescueImages: any = rescueImages;
  protected readonly RESCUE_PARTNERS: any = RESCUE_PARTNERS;

  // --- Giá trị tính toán (computed) ---
  readonly filteredPets = computed<any>(() => {
    const normalizedKeyword = this.keyword().trim().toLocaleLowerCase("vi");
    return this.rescuePets().filter((pet: any) => {
      const matchesStatus = this.status() === "all" || pet.state === this.status();
      const matchesKeyword =
        !normalizedKeyword ||
        [pet.name, pet.description, pet.status, pet.need].some((value: any) =>
          value.toLocaleLowerCase("vi").includes(normalizedKeyword),
        );
      return matchesStatus && matchesKeyword;
    });
  });
  readonly totalPages = computed<any>(() => Math.max(1, Math.ceil(this.filteredPets().length / RESCUE_PAGE_SIZE)));
  readonly pets = computed<any>(() => this.filteredPets().slice(
    (Number(this.currentPage()) - 1) * RESCUE_PAGE_SIZE,
    this.currentPage() * RESCUE_PAGE_SIZE,
  ));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly keyword = signal<any>("");
  readonly status = signal<any>("all");
  readonly currentPage = signal<any>(1);
  readonly selectedAdoptionPet = signal<any>(null);
  readonly rescuePets = signal<any>(RESCUE_PETS);
  readonly myRequests = signal<any>([]);
  readonly isLoading = signal<any>(false);
  readonly loadError = signal<any>("");
  readonly isLoadingMyRequests = signal<any>(false);

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");

        this.rescueApi.getAdoptionPets()
          .then((apiPets: any) => {
            if (!active) return;
            if (apiPets.length) this.rescuePets.set(apiPets);
          })
          .catch((error: any) => {
            if (!active) return;
            this.loadError.set(error?.message || "Không thể tải dữ liệu cứu trợ, đang hiển thị dữ liệu mẫu.");
          })
          .finally(() => {
            if (active) this.isLoading.set(false);
          });

        return () => {
          active = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });

    // useEffect(..., [isAuthenticated])
    effect((onCleanup: any) => {
      this.authService.isAuthenticated();
      const cleanup = untracked(() => {
        if (!this.authService.isAuthenticated()) {
          this.myRequests.set([]);
          return;
        }

        let active = true;
        this.isLoadingMyRequests.set(true);

        this.rescueApi.getMyAdoptionRequests()
          .then((requests: any) => {
            if (active) this.myRequests.set(requests);
          })
          .catch(() => {
            if (active) this.myRequests.set([]);
          })
          .finally(() => {
            if (active) this.isLoadingMyRequests.set(false);
          });

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [keyword, status])
    effect((onCleanup: any) => {
      this.keyword();
      this.status();
      const cleanup = untracked(() => {
        this.currentPage.set(1);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [currentPage, totalPages])
    effect((onCleanup: any) => {
      this.currentPage();
      this.totalPages();
      const cleanup = untracked(() => {
        if (this.currentPage() > this.totalPages()) this.currentPage.set(this.totalPages());
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected async handleSubmitAdoptionApplication(values: any) {
    const createdRequest = await this.rescueApi.createAdoptionRequest(this.selectedAdoptionPet()?.id, values);
    if (this.selectedAdoptionPet()) {
      this.myRequests.update((current: any) => [
        normalizeAdoptionRequest({
          ...createdRequest,
          adoption_pet: this.selectedAdoptionPet(),
          reason: values.adoptionReason || values.futurePlan || "",
        }),
        ...current,
      ]);
    }
    return createdRequest;
  }

  protected handle1() {
    this.currentPage.update((page: any) => Math.max(1, page - 1));
  }

  /** (tự sinh) Array.from(...) -> mảng để lặp bằng @for */
  protected range2(): any[] {
    return (Array.from({ length: this.totalPages() }) as any);
  }

  protected handle3() {
    this.currentPage.update((page: any) => Math.min(this.totalPages(), page + 1));
  }

  /** (tự sinh) global Boolean không dùng trực tiếp được trong template */
  protected compute4(): any {
    return Boolean(this.selectedAdoptionPet());
  }
}
