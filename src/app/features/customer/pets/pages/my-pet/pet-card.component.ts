import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { GenderIconComponent } from './gender-icon.component';
import {
  getLatestCheckupDate,
  getPetAgeText,
  getPetId,
  getPetBadgeColor,
  getPetStatusLabel,
  isPetHidden,
  petImages,
  toPetSlug,
} from './pet-list-page.helpers';

@Component({
  selector: 'article[app-pet-card]',
  standalone: true,
  imports: [GenderIconComponent],
  templateUrl: './pet-card.component.html',
  styleUrl: './pet-card.component.scss',
  host: {
    '[class]': "`flex w-[216px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#f8f7fe] shadow-[0_1px_3px_rgba(16,24,40,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(16,24,40,0.1)] focus:outline-none focus:ring-2 focus:ring-[#0d47a1] ${hidden() ? 'opacity-60 hover:opacity-90' : ''}`",
    '[attr.role]': "'link'",
    '[attr.tabindex]': '0',
    '[attr.aria-label]': "`Xem hồ sơ ${pet().name || 'thú cưng'}`",
    '(click)': 'handleCardClick($event)',
    '(keydown.enter)': 'handleCardKeydown($event)',
    '(keydown.space)': 'handleCardKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetCardComponent {
  private readonly navService = inject(CustomerNavigationService);

  readonly pet = input<any>({});

  readonly hidden = computed(() => isPetHidden(this.pet()));
  readonly statusLabel = computed(() => (this.hidden() ? 'Đã ẩn' : getPetStatusLabel(this.pet())));
  readonly badge = computed(() => getPetBadgeColor(this.statusLabel()));
  readonly image = computed(() => {
    const pet = this.pet();
    return pet.avatar || (pet.name ? (petImages as any)[pet.name] : null);
  });
  readonly ageText = computed(() => getPetAgeText(this.pet()));
  readonly petId = computed(() => getPetId(this.pet()));
  readonly slug = computed(() => toPetSlug(this.pet()));
  readonly subtitle = computed(() =>
    [this.pet().breed || 'Chưa phân loại', this.ageText()].filter(Boolean).join(' • ')
  );
  readonly checkup = computed(() => getLatestCheckupDate(this.pet()));

  protected handleCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button')) return;
    this.openDetails();
  }

    protected handleCardKeydown(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button')) return;
    event.preventDefault();
    this.openDetails();
  }


  private openDetails(): void {
    const targetSlug = this.slug() || this.petId();
    if (!targetSlug) return;
    this.navService.navigate(`/thu-cung-cua-toi/${targetSlug}`);
  }
}
