import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';

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
  readonly video=input<any>(null);
  readonly validUrl=computed(()=>{
    const value=String(this.video()?.url || '');
    try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}
  });
  readonly directMedia=computed(()=>/\.(mp4|webm|ogg)(?:\?|$)/i.test(String(this.video()?.url || '')));
}
