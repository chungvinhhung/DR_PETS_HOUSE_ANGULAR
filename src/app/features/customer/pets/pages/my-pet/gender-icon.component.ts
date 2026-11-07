import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * GenderIcon — chuyển từ React: src/pages/Pet/MyPetPage.jsx
 */
@Component({
  selector: 'app-gender-icon',
  standalone: true,
  imports: [],
  templateUrl: './gender-icon.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenderIconComponent {
  // --- Input / Output (props của React) ---
  readonly gender = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly isMale = computed<any>(() => this.gender() === 'Đực' || this.gender() === '♂');
  readonly isFemale = computed<any>(() => this.gender() === 'Cái' || this.gender() === '♀');

}
