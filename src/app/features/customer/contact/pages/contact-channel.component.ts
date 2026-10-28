import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * ContactChannel — chuyển từ React: src/pages/Contact/ContactPage.jsx
 */
@Component({
  selector: 'a[app-contact-channel]',
  standalone: true,
  imports: [],
  templateUrl: './contact-channel.component.html',
  host: {
    'class': 'contact-channel',
    '[attr.href]': 'channel().href',
    '[attr.target]': 'isExternal() ? \'_blank\' : undefined',
    '[attr.rel]': 'isExternal() ? \'noreferrer\' : undefined',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactChannelComponent {
  // --- Input / Output (props của React) ---
  readonly channel = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly isExternal = computed<any>(() => this.channel().href.startsWith("http"));

}
