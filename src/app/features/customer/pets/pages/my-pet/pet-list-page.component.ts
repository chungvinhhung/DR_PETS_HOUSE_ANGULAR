import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';

import { PetApiService } from '../../../../../core/customer/services/api/pet-api.service';
import { MyPetSearchAndSortComponent } from './my-pet-search-and-sort.component';
import { SpeciesIconComponent } from './species-icon.component';
import { GenderIconComponent } from './gender-icon.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { petImages, getHealthStatusColor, getPetStatusLabel, getLatestCheckupDate, getPetAgeText, getPetId, sortPets, PET_STATUS_FILTERS, toPetSlug } from './pet-list-page.helpers';

/**
 * PetListPage — chuyển từ React: src/pages/Pet/MyPetPage.jsx
 */
@Component({
  selector: 'div[app-pet-list-page]',
  standalone: true,
  imports: [MyPetSearchAndSortComponent, SpeciesIconComponent, GenderIconComponent, ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './pet-list-page.component.html',
  host: {
    'class': 'font-sans',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetListPageComponent {
  // --- Service dùng chung ---
  protected readonly petApi = inject(PetApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly PET_STATUS_FILTERS: any = PET_STATUS_FILTERS;
  protected readonly getHealthStatusColor: any = getHealthStatusColor;
  protected readonly getPetStatusLabel: any = getPetStatusLabel;
  protected readonly petImages: any = petImages;
  protected readonly getPetAgeText: any = getPetAgeText;
  protected readonly getPetId: any = getPetId;
  protected readonly getLatestCheckupDate: any = getLatestCheckupDate;
  protected readonly toPetSlug = toPetSlug;


  // --- Giá trị tính toán (computed) ---
  readonly counts = computed<any>(() => {
    return PET_STATUS_FILTERS.reduce((acc: any, status: any) => {
      (acc as any)[status] =
        status === "Tất cả"
          ? this.pets().length
          : this.pets().filter((pet: any) => {
              const displayStatus = getPetStatusLabel(pet);
              return displayStatus === status;
            }).length;
      return acc;
    }, {});
  });
  readonly filteredPets = computed<any>(() => {
    const normalizedSearch = this.searchQuery().trim().toLocaleLowerCase("vi");
    const result = this.pets().filter((pet: any) => {
      const displayStatus = getPetStatusLabel(pet);
      const matchesFilter = this.filterStatus() === "Tất cả" || displayStatus === this.filterStatus();
      const matchesSearch =
        !normalizedSearch ||
        [pet.name, pet.breed, pet.species]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });

    const rawSort = this.sortBy();
    const currentSort = typeof rawSort === 'object' && rawSort?.target ? rawSort.target.value : rawSort;
    return sortPets(result, currentSort);
  });

  // --- Trạng thái (signal = useState / useRef) ---
  readonly pets = signal<any>([]);
  readonly isLoading = signal<any>(true);
  readonly loadError = signal<any>("");
  readonly searchInput = signal<any>("");
  readonly searchQuery = signal<any>("");
  readonly filterStatus = signal<any>("Tất cả");
  readonly sortBy = signal<any>("name");

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");

        this.petApi.getMyPets()
          .then((items: any) => {
              if (active) {
                const normalizedPets = items.map((pet: any) => ({
                  ...pet,
                  healthStatus: getPetStatusLabel(pet),
                }));

                this.pets.set(normalizedPets);
              }
            })
          .catch((error: any) => {
            if (!active) return;
            this.pets.set([]);
            this.loadError.set(error?.message || "Không thể tải hồ sơ thú cưng.");
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
  }

  protected handle1() {
    this.searchInput.set("");
    this.searchQuery.set("");
  }
}
