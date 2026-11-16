import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * StepSection — chuyển từ React: src/pages/Blog/FirstAidDetailPage.jsx
 */
@Component({
  selector: 'section[app-step-section]',
  standalone: true,
  imports: [],
  templateUrl: './step-section.component.html',
  host: {
    'class': 'pt-10',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepSectionComponent {
  // --- Input / Output (props của React) ---
  readonly steps = input<any>(undefined);
  readonly badges = input<string[]>([]);
}
