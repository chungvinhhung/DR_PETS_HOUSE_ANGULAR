import { ChangeDetectionStrategy, Component, input, signal, OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { ReactStyleDirective } from '../../directives/react-style.directive';

/**
 * PetCareFaqSection — chuyển từ React: src/components/shared/PetCareFaqSection.jsx
 */
@Component({
  selector: 'section[app-pet-care-faq-section]',
  standalone: true,
  imports: [NgTemplateOutlet, ReactStyleDirective],
  templateUrl: './pet-care-faq-section.component.html',
  styleUrl: './pet-care-faq-section.component.scss',
  host: {
    'class': 'pet-care-faq',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetCareFaqSectionComponent implements OnInit {
  // --- Input / Output (props của React) ---
  readonly faqs = input<any>(undefined);
  readonly assets = input<any>(undefined);
  readonly listTop = input<any>(186);
  readonly renderAnswer = input<any>(undefined);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly openId = signal<any>(undefined);

  ngOnInit(): void {
    this.openId.set(this.faqs()[0]?.id ?? 1);
  }

  /** (tự sinh) global Array không dùng trực tiếp được trong template */
  protected cond1(faq: any): any {
    return Array.isArray(faq.answer);
  }
}
