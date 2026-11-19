import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import { BookingCardComponent } from './booking-card.component';
import { BookingFieldComponent } from './booking-field.component';

/**
 * PetInfoCard — chuyển từ React: src/pages/Booking/BookingPage.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onChange được gọi với 3 tham số -> gộp thành mảng
 */

@Component({
  selector: 'app-pet-info-card',
  standalone: true,
  imports: [BookingCardComponent, BookingFieldComponent],
  templateUrl: './pet-info-card.component.html',
  styleUrl: './pet-info-card.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetInfoCardComponent {
  // --- Input / Output (props của React) ---
  readonly petInfo = input<any>(undefined);
  readonly index = input<any>(undefined);
  readonly showIndex = input<any>(undefined);
  readonly canRemove = input<any>(undefined);
  readonly validationAttempted = input<any>(undefined);
  readonly onChange = output<any>();
  readonly onRemove = output<any>();

  protected readonly speciesOptions = ['Chó', 'Mèo', 'Khác'];
  private readonly fixedSpecies = ['Chó', 'Mèo'];

  readonly manualOtherSelected = signal<boolean>(false);

  constructor() {
    effect(() => {
      const current = String(this.petInfo()?.species || '').trim();
      if (current === 'Khác' || (current !== '' && !this.fixedSpecies.includes(current))) {
        this.manualOtherSelected.set(true);
      } else if (this.fixedSpecies.includes(current)) {
        this.manualOtherSelected.set(false);
      }
    }, { allowSignalWrites: true });
  }

  // Giá trị hiển thị ở dropdown bên trái
  readonly selectSpeciesValue = computed<string>(() => {
    const current = String(this.petInfo()?.species || '').trim();
    if (this.manualOtherSelected() || current === 'Khác' || (current !== '' && !this.fixedSpecies.includes(current))) {
      return 'Khác';
    }
    return current;
  });

  // Giá trị hiển thị ở ô nhập tự do bên phải
  readonly customSpeciesValue = computed<string>(() => {
    const current = String(this.petInfo()?.species || '').trim();
    if (current === 'Khác' || this.fixedSpecies.includes(current)) {
      return '';
    }
    return current;
  });

  protected handleSpeciesSelect(value: string): void {
  if (value === 'Khác') {
    this.manualOtherSelected.set(true);
    this.onChange.emit([this.petInfo().id, 'species', '']);
  } else {
    this.manualOtherSelected.set(false);
    this.onChange.emit([this.petInfo().id, 'species', value]);
  }
}

  protected handleCustomSpeciesInput(value: string): void {
    this.onChange.emit([this.petInfo().id, 'species', value]);
  }
}
