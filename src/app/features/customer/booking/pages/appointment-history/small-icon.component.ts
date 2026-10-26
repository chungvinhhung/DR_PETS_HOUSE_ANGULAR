import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * SmallIcon — chuyển từ React: src/pages/Booking/AppointmentHistoryPage.jsx
 */
@Component({
  selector: 'img[app-small-icon]',
  standalone: true,
  imports: [],
  templateUrl: './small-icon.component.html',
  host: {
    '[attr.src]': 'src()',
    '[attr.alt]': 'alt()',
    '[class]': '`h-[14px] w-[14px] shrink-0 object-contain ${className()}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmallIconComponent {
  // --- Input / Output (props của React) ---
  readonly src = input<any>(undefined);
  readonly alt = input<any>("");
  readonly className = input<any>("");

}
