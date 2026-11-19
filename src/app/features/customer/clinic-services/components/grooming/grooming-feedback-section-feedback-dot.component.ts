import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * GroomingFeedbackSectionFeedbackDot — chuyển từ React: src/components/groomingSpa/GroomingFeedbackSection.jsx (component FeedbackDot)
 */
@Component({
  selector: 'button[app-grooming-feedback-section-feedback-dot]',
  standalone: true,
  imports: [],
  templateUrl: './grooming-feedback-section-feedback-dot.component.html',
  styleUrl: './grooming-feedback-section-feedback-dot.component.scss',
  host: {
    'type': 'button',
    'role': 'tab',
    '(click)': 'onClick.emit($event)',
    '[attr.aria-label]': '`Trang phản hồi ${pageIndex() + 1} / ${totalPages()}`',
    '[attr.aria-selected]': 'isActive()',
    '[class]': '[ \'focus-ring-brand shrink-0 transition-all duration-component ease-premium\', isActive() ? \'h-[22px] w-[22px] rounded-[9px] border-[3px] border-[#02000F] bg-[#F4E11B] scale-110\' : \'h-[22px] w-[22px] rounded-[9px] bg-white hover:bg-[#FFFDE7] hover:scale-105 active:scale-95\' ].join(\' \')',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingFeedbackSectionFeedbackDotComponent {
  // --- Input / Output (props của React) ---
  readonly isActive = input<any>(undefined);
  readonly onClick = output<any>();
  readonly pageIndex = input<any>(undefined);
  readonly totalPages = input<any>(undefined);

}
