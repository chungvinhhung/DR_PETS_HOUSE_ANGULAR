import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';

/**
 * NavBarButton — chuyển từ React: src/components/Navbar/NavBarButton.jsx (component Button)
 */
@Component({
  selector: 'app-nav-bar-button',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './nav-bar-button.component.html',
  styleUrl: './nav-bar-button.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavBarButtonComponent {
  // --- Input / Output (props của React) ---
  readonly className = input<any>("");
  readonly color = input<any>("Primary");
  readonly size = input<any>("Large");
  readonly state = input<any>("Enabled");
  readonly variant = input<any>("Contained");
  readonly startIcon = input<any>(undefined);
  readonly endIcon = input<any>(undefined);
  readonly label = input<any>("ĐẶT LỊCH");
  readonly bookButtonBorder = input<any>(undefined);
  readonly bookButtonBackgroundColor = input<any>(undefined);
  readonly baseWidth = input<any>(undefined);
  readonly endIcon1 = input<any>(false);
  readonly startIcon1 = input<any>(false);
  readonly startIcon2 = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly bookButtonStyle = computed<any>(() => {
    return {
      border: this.bookButtonBorder(),
      backgroundColor: this.bookButtonBackgroundColor(),
    };
  });
  readonly baseStyle = computed<any>(() => {
    return {
      width: this.baseWidth(),
    };
  });

}
