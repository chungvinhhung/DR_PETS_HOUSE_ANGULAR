import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RichTextComponent } from './rich-text.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';

/**
 * PolicySection — chuyển từ React: src/pages/Policy/PolicyPage.jsx
 */
@Component({
  selector: 'section[app-policy-section]',
  standalone: true,
  imports: [RichTextComponent, ReactStyleDirective],
  templateUrl: './policy-section.component.html',
  styleUrl: './policy-section.component.scss',
  host: {
    'class': 'policy-article__section',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicySectionComponent {
  // --- Input / Output (props của React) ---
  readonly section = input<any>(undefined);

}
