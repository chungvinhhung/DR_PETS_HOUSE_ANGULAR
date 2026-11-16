import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { ModalButtonComponent } from './modal-button.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { ADOPTION_SUCCESS } from '../data/adoption-form-data';

/**
 * SuccessView — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'div[app-success-view]',
  standalone: true,
  imports: [ModalButtonComponent, CustomerIconComponent],
  templateUrl: './success-view.component.html',
  styleUrl: './success-view.component.scss',
  host: {
    'class': 'relative w-[884px] max-w-[calc(100vw-48px)] overflow-hidden rounded-[8px] border border-[#D9E3F6] bg-white p-px shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] sm:rounded-[32px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuccessViewComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);

  // --- Input / Output (props của React) ---
  readonly onClose = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly ADOPTION_SUCCESS: any = ADOPTION_SUCCESS;

  protected handle1() {
    this.onClose.emit(undefined);
    this.navService.navigate("/");
  }
}
