import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';

import { PetApiService } from '../../../../../core/customer/services/api/pet-api.service';
import { MyPetSearchAndSortComponent } from './my-pet-search-and-sort.component';
import { SpeciesIconComponent } from './species-icon.component';
import { GenderIconComponent } from './gender-icon.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { MOCK_PETS } from '../../data/mock-pets';
import { petImages, readStoredPets, getHealthStatusColor, parseAgeToDays, calculateAge, formatAgeText, getLatestCheckupDate, PET_STATUS_FILTERS } from './pet-list-page.helpers';

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
  protected readonly petImages: any = petImages;
  protected readonly formatAgeText: any = formatAgeText;
  protected readonly calculateAge: any = calculateAge;
  protected readonly getLatestCheckupDate: any = getLatestCheckupDate;

  // --- Giá trị tính toán (computed) ---
  readonly counts = computed<any>(() => {
    return PET_STATUS_FILTERS.reduce((acc: any, status: any) => {
      (acc as any)[status] =
        status === "Tất cả"
          ? this.pets().length
          : this.pets().filter((pet: any) => {
              const displayStatus = pet.healthStatus === "Khỏe mạnh" ? "Bình thường" : (pet.healthStatus || "Bình thường");
              return displayStatus === status;
            }).length;
      return acc;
    }, {});
  });
  readonly filteredPets = computed<any>(() => {
    const normalizedSearch = this.searchQuery().trim().toLocaleLowerCase("vi");
    const result = this.pets().filter((pet: any) => {
      const displayStatus = pet.healthStatus === "Khỏe mạnh" ? "Bình thường" : (pet.healthStatus || "Bình thường");
      const matchesFilter = this.filterStatus() === "Tất cả" || displayStatus === this.filterStatus();
      const matchesSearch =
        !normalizedSearch ||
        [pet.name, pet.breed, pet.species]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });

    if (this.sortBy() === "age") {
      return [...result].sort((a: any, b: any) => Number(parseAgeToDays(b.age)) - Number(parseAgeToDays(a.age)));
    }

    return [...result].sort((a: any, b: any) => a.name.localeCompare(b.name, "vi"));
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
                  healthStatus:
                    pet.healthStatus === 'NORMAL' ||
                    pet.healthStatus === 'HEALTHY' ||
                    pet.healthStatus === 'Khỏe mạnh'
                      ? 'Bình thường'
                      : pet.healthStatus === 'SICK' || pet.healthStatus === 'ILL'
                        ? 'Bị bệnh'
                        : pet.healthStatus || 'Bình thường',
                }));

                this.pets.set(normalizedPets);
              }
            })
          .catch((error: any) => {
            if (!active) return;
            const storedPets = readStoredPets();
            this.pets.set(storedPets.length ? storedPets : MOCK_PETS);
            this.loadError.set(error?.message || "Không thể tải hồ sơ thú cưng, đang hiển thị dữ liệu mẫu.");
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
