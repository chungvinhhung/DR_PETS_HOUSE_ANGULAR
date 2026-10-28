import { ChangeDetectionStrategy, Component } from '@angular/core';

import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { ScaledCanvasLayoutComponent } from '../../../../shared/customer/components/scaled-canvas-layout/scaled-canvas-layout.component';
import { ShopCanvasComponent } from './shop-canvas.component';
import { FooterComponent } from '../../../../layouts/customer/components/footer/footer.component';

/**
 * ShopPage — chuyển từ React: src/pages/Shop/ShopPage.jsx
 */
@Component({
  selector: 'div[app-shop-page]',
  standalone: true,
  imports: [NavBarComponent, ScaledCanvasLayoutComponent, ShopCanvasComponent, FooterComponent],
  templateUrl: './shop-page.component.html',
  host: {
    'class': 'min-h-screen bg-[#f5f5f5]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopPageComponent {
}
