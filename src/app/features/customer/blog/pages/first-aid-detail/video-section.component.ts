import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';

/**
 * VideoSection — chuyển từ React: src/pages/Blog/FirstAidDetailPage.jsx
 */
@Component({
  selector: 'section[app-video-section]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './video-section.component.html',
  host: {
    'class': 'mt-6 flex min-h-[405px] items-center rounded-[32px] bg-[#0D47A1] px-16 text-white shadow-[0_12px_25px_rgba(13,71,161,0.2)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoSectionComponent {
  // --- Input / Output (props của React) ---
  readonly video = input<any>(undefined);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly playing = signal<any>(false);

  protected handle1() {
    this.playing.update((value: any) => !value);
  }
}
