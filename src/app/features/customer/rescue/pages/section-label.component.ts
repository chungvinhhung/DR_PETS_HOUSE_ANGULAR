import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * SectionLabel — chuyển từ React: src/pages/Rescue/RescuePage.jsx
 */
@Component({
  selector: 'div[app-section-label]',
  standalone: true,
  imports: [],
  templateUrl: './section-label.component.html',
  styleUrl: './section-label.component.scss',
  host: {
    'class': 'inline-flex h-[24px] items-center gap-2 rounded-full bg-[#FDD835] px-3 text-[11px] font-bold leading-none text-[#715B00]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionLabelComponent {
}
