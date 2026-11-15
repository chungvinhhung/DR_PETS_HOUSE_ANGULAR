import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CustomerAuthService } from '../../../../../core/customer/services/customer-auth.service';
import { serviceSelectedCheck, informationSelectedPetPhoto, petImages } from './booking-page.helpers';

const buddyImg = '/assets/customer/images/pets/buddy.jpg';

/**
 * PetSummaryCard — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'button[app-pet-summary-card]',
  standalone: true,
  imports: [],
  templateUrl: './pet-summary-card.component.html',
  host: {
    'type': 'button',
    '(click)': 'onClick.emit($event)',
    '[class]': '`relative flex min-h-[116px] items-center gap-3 rounded-2xl bg-white p-5 text-left shadow-[0_4px_13px_rgba(144,202,249,0.85)] md:p-[26px] ${ active() ? \'border-2 border-blue-900\' : \'border-2 border-transparent\' }`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetSummaryCardComponent {
  protected readonly authService = inject(CustomerAuthService);

  // --- Input / Output (props của React) ---
  readonly selectedPets = input<any>(undefined);
  readonly active = input<any>(undefined);
  readonly onClick = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly serviceSelectedCheck: any = serviceSelectedCheck;
  protected readonly informationSelectedPetPhoto: any = informationSelectedPetPhoto;
  protected readonly petImages: any = petImages;
  protected readonly buddyImg: any = buddyImg;

  // --- Giá trị tính toán (computed) ---
  readonly selectedPet = computed<any>(() => this.selectedPets()[0]);
  readonly extraCount = computed<any>(() => Math.max(this.selectedPets().length - 1, 0));

}
