import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * WhyItem — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'article[app-why-item]',
  standalone: true,
  imports: [],
  templateUrl: './why-item.component.html',
  host: {
    '[class]': '`medical-why__item medical-why__item--${align()}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhyItemComponent {
  // --- Input / Output (props của React) ---
  readonly item = input<any>(undefined);
  readonly align = input<any>(undefined);

}
