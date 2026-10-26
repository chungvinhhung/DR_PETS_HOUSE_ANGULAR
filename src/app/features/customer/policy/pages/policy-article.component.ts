import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PolicySectionComponent } from './policy-section.component';

/**
 * PolicyArticle — chuyển từ React: src/pages/Policy/PolicyPage.jsx
 */
@Component({
  selector: 'article[app-policy-article]',
  standalone: true,
  imports: [PolicySectionComponent],
  templateUrl: './policy-article.component.html',
  host: {
    'class': 'policy-article w-[813px] shrink-0 rounded-[12px] bg-white px-8 pb-8 pt-6',
    'data-node-id': '3102:10676',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyArticleComponent {
  // --- Input / Output (props của React) ---
  readonly policy = input<any>(undefined);

}
