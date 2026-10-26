import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * AssetIcon — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'img[app-asset-icon]',
  standalone: true,
  imports: [],
  templateUrl: './asset-icon.component.html',
  host: {
    '[attr.src]': 'src()',
    '[attr.alt]': 'alt()',
    '[class]': 'className()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetIconComponent {
  // --- Input / Output (props của React) ---
  readonly src = input<any>(undefined);
  readonly alt = input<any>("");
  readonly className = input<any>("h-5 w-5");

}
