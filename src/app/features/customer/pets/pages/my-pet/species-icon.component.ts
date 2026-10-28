import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';

const dogIcon = '/assets/customer/icons/dog-icon.png';
const catIcon = '/assets/customer/icons/cat-icon.png';
const pawIcon = '/assets/customer/icons/paw-icon.png';

/**
 * SpeciesIcon — chuyển từ React: src/pages/Pet/MyPetPage.jsx
 */
@Component({
  selector: 'app-species-icon',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './species-icon.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeciesIconComponent {
  // --- Input / Output (props của React) ---
  readonly species = input<any>(undefined);
  readonly gender = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly isMale = computed<any>(() => this.gender() === 'Đực' || this.gender() === '♂');
  readonly isFemale = computed<any>(() => this.gender() === 'Cái' || this.gender() === '♀');
  readonly maskColorClass = computed<any>(() => {
    let maskColorClass: any = "bg-slate-400 text-slate-400";
    if (this.isMale()) maskColorClass = "bg-blue-500 text-blue-500";
      else if (this.isFemale()) maskColorClass = "bg-pink-500 text-pink-500";
    return maskColorClass;
  });
  readonly boldFilter = computed<any>(() => "drop-shadow(0px 0px 0.5px currentColor) drop-shadow(0.5px 0px 0px currentColor) drop-shadow(0px 0.5px 0px currentColor)");
  readonly targetIcon = computed<any>(() => {
    let targetIcon: any = pawIcon;
    if (this.species() === "Chó") targetIcon = dogIcon;
      else if (this.species() === "Mèo") targetIcon = catIcon;
    return targetIcon;
  });

}
