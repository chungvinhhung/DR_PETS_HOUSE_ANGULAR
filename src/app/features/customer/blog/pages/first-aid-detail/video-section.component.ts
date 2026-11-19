import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';

/**
 * VideoSection — chuyển từ React: src/pages/Blog/FirstAidDetailPage.jsx
 */
@Component({
  selector: 'section[app-video-section]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './video-section.component.html',
  styleUrl: './video-section.component.scss',
  host: {
    'class': 'mt-6 flex min-h-[405px] flex-col items-center gap-8 rounded-[32px] bg-[#0D47A1] px-6 py-10 text-white sm:px-10 lg:flex-row lg:gap-0 lg:px-16 lg:py-0 shadow-[0_12px_25px_rgba(13,71,161,0.2)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoSectionComponent {
  readonly video = input<any>(null);
  readonly playing = signal<boolean>(false);

  readonly validUrl = computed(() => {
    const value = String(this.video()?.url || '');
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  });

  readonly directMedia = computed(() =>
    /\.(mp4|webm|ogg)(?:\?|$)/i.test(String(this.video()?.url || ''))
  );

  protected handle1() {
    this.playing.update((value: any) => !value);
  }
}
