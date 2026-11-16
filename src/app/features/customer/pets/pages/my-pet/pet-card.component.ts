import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { GenderIconComponent } from './gender-icon.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import {
  getLatestCheckupDate,
  getPetAgeText,
  getPetId,
  getPetBadgeColor,
  getPetStatusLabel,
  isPetHidden,
  petImages,
} from './pet-list-page.helpers';

@Component({
  selector: 'article[app-pet-card]',
  standalone: true,
  imports: [GenderIconComponent, CustomerLinkDirective],
  templateUrl: './pet-card.component.html',
  styleUrl: './pet-card.component.scss',
  host: {
    '[class]': "`flex flex-col overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#f8f7fe] shadow-[0_1px_3px_rgba(16,24,40,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(16,24,40,0.1)] ${hidden() ? 'opacity-60 hover:opacity-90' : ''}`",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetCardComponent {
  readonly pet = input<any>({});

  readonly hidden = computed(() => isPetHidden(this.pet()));
  readonly statusLabel = computed(() => getPetStatusLabel(this.pet()));
  readonly badge = computed(() => getPetBadgeColor(this.statusLabel()));
  readonly image = computed(() => {
    const pet = this.pet();
    return pet.avatar || (pet.name ? (petImages as any)[pet.name] : null);
  });
  readonly ageText = computed(() => getPetAgeText(this.pet()));
  readonly petId = computed(() => getPetId(this.pet()));
  readonly subtitle = computed(() => [this.pet().breed, this.ageText()].filter(Boolean).join(' • '));
  readonly checkup = computed(() => getLatestCheckupDate(this.pet()));
}
