import { ChangeDetectionStrategy, Component } from '@angular/core';

import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { FooterComponent } from '../../../../layouts/customer/components/footer/footer.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { NOT_FOUND_COPY } from './not-found-page.helpers';

const sleepingPetImage = '/assets/customer/images/not-found/sleeping-pet.png';
const tennisBallImage = '/assets/customer/images/not-found/tennis-ball.png';

/**
 * NotFoundPage — chuyển từ React: src/pages/Error/NotFoundPage.jsx
 */
@Component({
  selector: 'div[app-not-found-page]',
  standalone: true,
  imports: [NavBarComponent, FooterComponent, CustomerLinkDirective],
  templateUrl: './not-found-page.component.html',
  host: {
    'class': 'min-h-screen bg-white font-sans',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPageComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly sleepingPetImage: any = sleepingPetImage;
  protected readonly tennisBallImage: any = tennisBallImage;
  protected readonly NOT_FOUND_COPY: any = NOT_FOUND_COPY;

}
